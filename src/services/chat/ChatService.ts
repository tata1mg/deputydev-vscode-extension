// file: webview-ui/src/services/querySolverService.ts
import { v4 as uuidv4 } from 'uuid';
import { API_ENDPOINTS } from '../api/endpoints';
import {api} from '../api/axios';
import {getSessionId} from "../../utilities/contextManager";
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { AuthService } from '../auth/AuthService';
import { RawData } from "ws";
import { BaseWebSocketClient } from "../../clients/baseClients/baseWebsocketClient";
import { DD_HOST_WS } from '../../config';


interface StreamEvent {
  type: string;
  content?: any; // content can be undefined or empty
}


export class QuerySolverService {
  public async *querySolver(payload: unknown, signal?: AbortSignal): AsyncIterableIterator<any> {
    // Dynamically retrieve the current session ID for each call
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    if (!authToken) {
      throw new Error("Missing auth token. Ensure user is logged in.");
    }
    const currentSessionId = getSessionId();
    let streamDone = false;
    let streamError: Error | null = null;
    const eventsQueue: StreamEvent[] = [];

    // websocket stream message hadler
    const handleMessage = (event: RawData): "RESOLVE" | "REJECT" | "WAIT" => {
      try {
        const messageData = JSON.parse(event.toString());
        console.log("Received WebSocket message in parser:", messageData);
        if (messageData.type === 'STREAM_START') {
          if (messageData.new_session_data) {
            refreshCurrentToken({
              "new_session_data": messageData.new_session_data
            });
          }
        }
        if (messageData.type === 'STREAM_END') {
          streamDone = true;
          return "RESOLVE";
        } else if (messageData.type === 'STREAM_ERROR') {
          streamDone = true;
          streamError = Error(messageData.message);
          return "REJECT";
        }
        eventsQueue.push({ type: messageData.type, content: messageData.content })
      }
      catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
        return "REJECT";
      }
      return "WAIT";
    }

    let websocketClient = new BaseWebSocketClient(
      DD_HOST_WS,
      API_ENDPOINTS.QUERY_SOLVER,
      authToken,
      handleMessage,
      {...(currentSessionId ? {"X-Session-ID" : currentSessionId.toString()} : {})}
    );

    let dataToSend: any = payload;

    websocketClient.send(dataToSend);
    console.log("QuerySolverService: querySolver sent data:", dataToSend);

    // ✅ Abort handling - immediately kill the stream if signal is aborted
    if (signal) {
      signal.addEventListener('abort', () => {
        console.warn('querySolver stream aborted by user');
        websocketClient.close();
        streamDone = true;
      });
    }

    // Yield events as they are received, and handle any errors that occur
    while (!streamDone || eventsQueue.length > 0) {
      if (streamError) {
        websocketClient.close();
        throw streamError;
      }
      if (signal?.aborted) {
        console.warn('querySolver aborted during loop');
        websocketClient.close();
        return;
      }
      
      if (eventsQueue.length > 0) {
        yield eventsQueue.shift()!;
      } else {
        // Wait a short period before checking the queue again
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    websocketClient.close();
  }
}
