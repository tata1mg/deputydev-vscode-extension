import { v4 as uuidv4 } from 'uuid';
import { API_ENDPOINTS } from '../api/endpoints';
import { api } from '../api/axios';
import { getSessionId, sendNotVerified } from "../../utilities/contextManager";
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { AuthService } from '../auth/AuthService';
import { RawData } from "ws";
import { BaseWebSocketClient } from "../../clients/baseClients/baseWebsocketClient";
import { DD_HOST_WS } from '../../config';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { SESSION_TYPE } from '../../constants';

interface StreamEvent {
  type: string;
  content?: any; // content can be undefined or empty
}

export class QuerySolverService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.logger = SingletonLogger.getInstance();
    this.context = context;
  }

  public async *querySolver(
    payload: Record<string, any>,
    signal?: AbortSignal
  ): AsyncIterableIterator<any> {
    let firstAttemptYielded = false;

    try {
      for await (const event of this._runQuerySolverAttempt(payload, signal)) {
        firstAttemptYielded = true;
        yield event;
      }
    } catch (err) {
      if (!firstAttemptYielded) {
        this.logger.warn("querySolver failed...", err);
        // console.warn("⚠️ querySolver failed on first attempt, retrying once...", err);
        await new Promise(res => setTimeout(res, 200)); // small delay before retry
        for await (const event of this._runQuerySolverAttempt(payload, signal)) {
          yield event;
        }
      } else {
        // console.error("⚠️ querySolver failed after first attempt", err);
        this.logger.error("querySolver failed", err);
        throw err;
      }
    }
  }

  private async *_runQuerySolverAttempt(
    payload: Record<string, any>,
    signal?: AbortSignal
  ): AsyncIterableIterator<any> {
    const authService = new AuthService();
    let authToken = await authService.loadAuthToken();
    if (!authToken) {
      throw new Error("Missing auth token. Ensure user is logged in.");
    }

    const currentSessionId = getSessionId();
    let streamDone = false;
    let streamError: Error | null = null;
    const eventsQueue: StreamEvent[] = [];

    const handleMessage = (event: RawData): "RESOLVE" | "REJECT" | "WAIT" | 'REJECT_AND_RETRY' => {
      try {
        const messageData = JSON.parse(event.toString());
        if (messageData.type === 'STREAM_START') {
          if (messageData.new_session_data) {
            refreshCurrentToken({
              "new_session_data": messageData.new_session_data
            });
          }
        } else if (messageData.type === 'STREAM_END') {
          streamDone = true;
          return "RESOLVE";
        } else if (messageData.type === 'STREAM_ERROR') {
          if (messageData.status == 'NOT_VERIFIED') {

            streamError = new Error("Session not verified");
            sendNotVerified();
            return "REJECT_AND_RETRY";
          }
          // console.error("❌ Error in WebSocket stream:", messageData.message);
          this.logger.error("Error in querysolver WebSocket stream: ", messageData.message);
          // console.error("Error in WebSocket stream:", messageData.message);
          streamError = Error(messageData.message);
          return "REJECT";
        }
        eventsQueue.push({ type: messageData.type, content: messageData.content });
      } catch (error) {
        // console.error("Error parsing WebSocket message:", error);
        this.logger.error("Error parsing querysolver WebSocket message");
        // console.error("❌ Error parsing WebSocket message:", error);
        return "REJECT";
      }
      return "WAIT";
    };

    let websocketClient = new BaseWebSocketClient(
      DD_HOST_WS,
      API_ENDPOINTS.QUERY_SOLVER,
      authToken,
      handleMessage,
      {
        ...(currentSessionId ? { "X-Session-ID": currentSessionId.toString() } : {}),
        "X-Session-Type": SESSION_TYPE
      }
    );

    websocketClient.send(payload).then(
      () => websocketClient.close()
    ).catch(
      (error) => {
        console.error("Error sending message to WebSocket:", error);
        streamError = error;
        websocketClient.close();
      }
    );

    if (signal) {
      signal.addEventListener('abort', () => {
        // console.warn('querySolver stream aborted by user');
        websocketClient.close();
        streamDone = true;
      });
    }

    while (!streamDone || eventsQueue.length > 0) {
      if (streamError) {
        // this.logger.error("Error in querysolver WebSocket stream:", streamError);
        // console.error("Error in querysolver WebSocket stream:", streamError);
        websocketClient.close();
        this.logger.info("Error in querysolver WebSocket stream:", streamError);
        if (streamError === 'RETRY_NEEDED') {
          this.logger.info("Error in querysolver WebSocket stream 1:", streamError);
          let isAuthenticated = this.context.workspaceState.get("isAuthenticated");
          // wait until the user is authenticated or 10 minutes have passed
          const startTime = Date.now();
          const maxWaitTime = 10 * 60 * 1000; // 10 minutes
          while (!isAuthenticated && (Date.now() - startTime) < maxWaitTime) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            isAuthenticated = this.context.workspaceState.get("isAuthenticated");
          }
          if (!isAuthenticated) {
            throw new Error("Session not verified");
          }
          authToken = await authService.loadAuthToken();
          websocketClient = new BaseWebSocketClient(
            DD_HOST_WS,
            API_ENDPOINTS.QUERY_SOLVER,
            authToken,
            handleMessage,
            {
              ...(currentSessionId ? { "X-Session-ID": currentSessionId.toString() } : {}),
              "X-Session-Type": SESSION_TYPE
            }
          );
      
          websocketClient.send(payload).then(
            () => websocketClient.close()
          ).catch(
            (error) => {
              console.error("Error sending message to WebSocket:", error);
              streamError = error;
              websocketClient.close();
            }
          );
          continue;
        }

        throw streamError;
      }
      if (signal?.aborted) {
        // console.warn('querySolver aborted during loop');
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
