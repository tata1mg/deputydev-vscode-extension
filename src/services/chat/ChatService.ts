// file: webview-ui/src/services/querySolverService.ts
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { v4 as uuidv4 } from 'uuid';
import { API_ENDPOINTS } from '../api/endpoints';
import {api} from '../api/axios';
import {getSessionId} from "../../utilities/contextManager";
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { AuthService } from '../auth/AuthService';


interface SSEEvent {
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
    let response;
    try {
      response = await api({
        url: API_ENDPOINTS.QUERY_SOLVER,
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          'X-REQUEST-ID': uuidv4(),
          'Accept': 'text/event-stream',
          'X-Session-Id': currentSessionId,
          'Authorization': 'Bearer ' + authToken
        },
        data: payload,
        responseType: 'stream'
      });
    } catch (error) {
      console.error('Error in querySolver API call:', error);
      throw error;
    }
    refreshCurrentToken(response.headers)
    const stream = response.data;
    let streamDone = false;
    let streamError: Error | null = null;
    const eventsQueue: SSEEvent[] = [];

    // Parser: push every event with its type and content (if any)
    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        try {
          if (!event.data) return;
          const parsedData = JSON.parse(event.data);
          eventsQueue.push({ type: parsedData.type, content: parsedData.content });
        } catch (error) {
          console.warn('SSE Parsing Error:', error);
        }
      },
      onRetry: (interval: number) => {
        console.warn(`SSE: Server requested retry after ${interval}ms`);
      },
      onError: (error: Error) => {
        console.error('SSE Parser Error:', error);
        streamDone = true;
        streamError = error;
      },
      onComment: (comment: string) => {
        console.debug('SSE Comment:', comment);
      },
    });

    stream.on('data', (chunk: Buffer) => {
      parser.feed(chunk.toString());
    });

    stream.on('end', () => {
      streamDone = true;
    });

    stream.on('error', (err: any) => {
      console.error('Stream Error:', err);
      streamDone = true;
      streamError = err;
    });

    // ✅ Abort handling - immediately kill the stream if signal is aborted
    if (signal) {
      signal.addEventListener('abort', () => {
        console.warn('querySolver stream aborted by user');
        stream.destroy(); // ✅ force close
        streamDone = true;
      });
    }

    // Yield events as they are received, and handle any errors that occur
    while (!streamDone || eventsQueue.length > 0) {
      if (streamError) {
        throw streamError;
      }
      if (signal?.aborted) {
        console.warn('querySolver aborted during loop');
        stream.destroy();
        return;
      }
      
      if (eventsQueue.length > 0) {
        yield eventsQueue.shift()!;
      } else {
        // Wait a short period before checking the queue again
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }
}
