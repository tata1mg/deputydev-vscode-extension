import { v4 as uuidv4 } from 'uuid';
import { API_ENDPOINTS } from '../api/endpoints';
import {api} from '../api/axios';
import {getSessionId} from "../../utilities/contextManager";
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { AuthService } from '../auth/AuthService';
import { RawData } from "ws";
import { BaseWebSocketClient } from "../../clients/baseClients/baseWebsocketClient";
import { DD_HOST_WS } from '../../config';

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface StreamEvent {
  type: string;
  content?: any; // content can be undefined or empty
}

export class QuerySolverService {
  private async getDeputyDevRulesContent(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const filePath = path.join(rootPath, ".deputydevrules");

    try {
      if (fs.existsSync(filePath)) {
        console.log("Reading .deputydevrules file from workspace");
        return fs.readFileSync(filePath, "utf8");
      }
      console.log("No .deputydevrules file found in workspace");
    } catch (error) {
      console.error("Error reading .deputydevrules file:", error);
    }
    return null;
  }

  public async *querySolver(
    payload: Record<string, any>,
    signal?: AbortSignal
  ): AsyncIterableIterator<any> {
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
        if (messageData.type === 'STREAM_END') {
          streamDone = true;
          return "RESOLVE";
        } else if (messageData.type === 'ERROR') {
          streamDone = true;
          streamError = Error("Some error");
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

    //refreshCurrentToken(response.headers);
    websocketClient.send(dataToSend);
    console.log("QuerySolverService: querySolver sent data:", dataToSend);

    if (signal) {
      signal.addEventListener('abort', () => {
        console.warn('querySolver stream aborted by user');
        websocketClient.close();
        streamDone = true;
      });
    }

    while (!streamDone || eventsQueue.length > 0) {
      if (streamError) {
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
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    websocketClient.close();
  }
}
