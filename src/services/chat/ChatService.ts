import { getSessionId, sendForceUpgrade, sendNotVerified } from '../../utilities/contextManager';
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { AuthService } from '../auth/AuthService';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import * as vscode from 'vscode';
import { SESSION_TYPE } from '../../constants';
import { ReferenceManager } from '../../references/ReferenceManager';
import { BackendClient } from '../../clients/backendClient';
import { CLIENT_VERSION } from '../../config';

interface StreamEvent {
  type: string;
  content?: any; // content can be undefined or empty
}

export class QuerySolverService {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly context: vscode.ExtensionContext;
  private readonly DD_HOST_WS: string;
  private readonly QUERY_SOLVER_ENDPOINT: string;
  private readonly referenceManager: ReferenceManager;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly backendClient: BackendClient;

  constructor(context: vscode.ExtensionContext, outputChannel: vscode.LogOutputChannel, backendClient: BackendClient) {
    this.logger = SingletonLogger.getInstance();
    this.outputChannel = outputChannel;
    this.context = context;
    const configData = this.context.workspaceState.get('essentialConfigData') as any;
    if (!configData) {
      throw new Error('Config data not found in workspace state');
    }
    this.DD_HOST_WS = configData.DD_HOST_WS;
    this.QUERY_SOLVER_ENDPOINT = configData.QUERY_SOLVER_ENDPOINT;
    this.referenceManager = new ReferenceManager(context, this.outputChannel);
    this.backendClient = backendClient;
  }

  public async *querySolver(payload: Record<string, any>, signal?: AbortSignal): AsyncIterableIterator<any> {
    let firstAttemptYielded = false;

    try {
      for await (const event of this._runQuerySolverAttempt(payload, signal)) {
        firstAttemptYielded = true;
        yield event;
      }
    } catch (err) {
      if (!firstAttemptYielded) {
        this.logger.warn('querySolver failed...', err);
        await new Promise((res) => setTimeout(res, 200)); // small delay before retry
        for await (const event of this._runQuerySolverAttempt(payload, signal)) {
          yield event;
        }
      } else {
        this.logger.error('querySolver failed', err);
        throw err;
      }
    }
  }

  private async *_runQuerySolverAttempt(
    payload: Record<string, any>,
    signal?: AbortSignal,
  ): AsyncIterableIterator<any> {
    const authService = new AuthService();
    let authToken = await authService.loadAuthToken();

    const currentSessionId = getSessionId();
    const finalPayload = await this.preparePayload(payload);
    finalPayload.session_id = currentSessionId;
    finalPayload.session_type = SESSION_TYPE;
    finalPayload.auth_token = authToken;

    let streamDone = false;
    let streamError: Error | null = null;
    const eventsQueue: StreamEvent[] = [];

    const handleMessage = (messageData: any): void => {
      try {
        if (messageData.type === 'STREAM_START') {
          if (messageData.new_session_data) {
            refreshCurrentToken({
              new_session_data: messageData.new_session_data,
            });
          }
        } else if (messageData.type === 'STREAM_END') {
          streamDone = true;
          this.backendClient.querySolver.close();
          return;
        } else if (messageData.type === 'STREAM_ERROR') {
          if (messageData.status == 'NOT_VERIFIED') {
            streamError = new Error('Session not verified');
            sendNotVerified();
            this.backendClient.querySolver.close();
            return;
          } else if (messageData.status == 'INVALID_CLIENT_VERSION') {
            this.logger.error('Invalid client version in querysolver WebSocket stream');
            streamError = new Error('Invalid client version');
            sendForceUpgrade({
              url: messageData.message.client_download_link,
              upgradeVersion: messageData.message.upgrade_version,
              currentVersion: CLIENT_VERSION,
            });
            this.backendClient.querySolver.close();
            return;
          }
          this.logger.error('Error in querysolver WebSocket stream: ', messageData);
          streamError = new Error(messageData);
          this.backendClient.querySolver.close();
          return;
        }
        eventsQueue.push({ type: messageData.type, content: messageData.content });
      } catch (error) {
        this.logger.error('Error parsing querysolver WebSocket message', error);
        this.backendClient.querySolver.close();
      }
    };

    // call the querySolver websocket endpoint
    try {
      this.backendClient.querySolver.onMessage.on('message', handleMessage);
      console.log('Sending querySolver payload:', finalPayload);
      await this.backendClient.querySolver.sendMessageWithRetry(finalPayload);
      console.log('querySolver WebSocket stream started successfully');
    } catch (error: any) {
      console.log('Error calling querySolver endpoint:', error);
      streamError = error;
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        this.backendClient.querySolver.close();
        streamDone = true;
      });
    }

    while (!streamDone || eventsQueue.length > 0) {
      if (streamError) {
        this.backendClient.querySolver.close();
        console.log('Error in querysolver WebSocket stream:', streamError);
        if (streamError instanceof Error && streamError.message === 'Session not verified') {
          let isAuthenticated = this.context.workspaceState.get('isAuthenticated');
          console.log('Session not verified, waiting for authentication...', isAuthenticated);
          // wait until the user is authenticated or 10 minutes have passed
          const startTime = Date.now();
          const maxWaitTime = 10 * 60 * 1000; // 10 minutes
          while (!isAuthenticated && Date.now() - startTime < maxWaitTime) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            isAuthenticated = this.context.workspaceState.get('isAuthenticated');
          }
          if (!isAuthenticated) {
            throw new Error('Session not verified');
          }
          authToken = await authService.loadAuthToken();
          streamDone = false;
          streamError = null;
          await this.backendClient.querySolver.sendMessageWithRetry({
            ...finalPayload,
            auth_token: authToken,
          });
          continue; // Retry the querySolver call
        }

        throw streamError;
      }
      if (signal?.aborted) {
        this.backendClient.querySolver.close();
        return;
      }

      if (eventsQueue.length > 0) {
        yield eventsQueue.shift()!;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Clean up the WebSocket connection
    this.backendClient.querySolver.close();
  }

  /**
   * Ensure the outbound WebSocket message is ≤100 KB; if it is larger,
   * off-load it to S3 and return a lightweight envelope.
   */
  private async preparePayload(original: Record<string, any>): Promise<Record<string, any>> {
    // ── 1. Measure size ──────────────────────────────────────────────
    const serialised = JSON.stringify(original);
    const byteSize = Buffer.byteLength(serialised, 'utf8');
    const mainConfigData = this.context.workspaceState.get('configData') as any;
    const CHAT_PAYLOAD_MAX_SIZE = mainConfigData.CHAT_PAYLOAD_MAX_SIZE * 1024 || 100 * 1024; // Default to 100 KB if not set
    if (byteSize <= CHAT_PAYLOAD_MAX_SIZE) {
      return original;
    }

    // ── 2. Too big → store in S3 (folder: 'payload') ────────────────
    try {
      const { key: attachment_id } = await this.referenceManager.uploadPayloadToS3(serialised);

      // Keep only the routing fields + attachment pointer
      return {
        type: 'PAYLOAD_ATTACHMENT',
        attachment_id,
      };
    } catch (err) {
      this.logger.error('preparePayload: failed to off-load payload via ReferenceManager', err);
      // Fallback: return original (backend may still reject if >128 KB)
      return original;
    }
  }
}
