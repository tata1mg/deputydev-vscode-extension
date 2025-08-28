import * as vscode from 'vscode';
import { BackendClient } from '../../clients/backendClient';
import { SESSION_TYPE } from '../../constants';
import { ReferenceManager } from '../../references/ReferenceManager';
import { InputTokenLimitErrorData, ThrottlingErrorData } from '../../types';
import { getContextRepositories, getSessionId, setCancelButtonStatus } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { BaseWebsocketEndpoint } from '../../clients/base/baseClient';

interface StreamEvent {
  type: string;
  content?: any; // content can be undefined or empty
}

export class QuerySolverService {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly context: vscode.ExtensionContext;
  private readonly referenceManager: ReferenceManager;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly backendClient: BackendClient;
  private socketConn: BaseWebsocketEndpoint | null = null;

  constructor(context: vscode.ExtensionContext, outputChannel: vscode.LogOutputChannel, backendClient: BackendClient) {
    this.logger = SingletonLogger.getInstance();
    this.outputChannel = outputChannel;
    this.context = context;
    const configData = this.context.workspaceState.get('essentialConfigData');
    if (!configData) {
      throw new Error('Config data not found in workspace state');
    }
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
    const repositories = await getContextRepositories();

    const currentSessionId = getSessionId();

    // adding context of repositories present in workspace except active repository in payload.
    payload['repositories'] = repositories || [];
    const finalPayload = await this.preparePayload(payload);
    finalPayload.session_id = currentSessionId;
    finalPayload.session_type = SESSION_TYPE;

    let streamDone = false;
    let streamError: Error | null = null;
    const eventsQueue: StreamEvent[] = [];

    if (!this.socketConn) {
      console.log('Using new socket');
      this.socketConn = this.backendClient.querySolver();
    }

    const handleMessage = (messageData: any): void => {
      try {
        if (messageData.type === 'STREAM_START') {
          if (messageData.new_session_data) {
            refreshCurrentToken({
              new_session_data: messageData.new_session_data,
            });
          }
          setCancelButtonStatus(true);
        } else if (messageData.type === 'STREAM_END_CLOSE_CONNECTION') {
          this.dispose();
          streamDone = true;
          return;
        } else if (messageData.type === 'STREAM_END') {
          streamDone = true;
          return;
        } else if (messageData.type === 'STREAM_ERROR') {
          if (messageData.status === 'LLM_THROTTLED') {
            streamError = new ThrottlingException(messageData);
            return;
          } else if (messageData.status === 'INPUT_TOKEN_LIMIT_EXCEEDED') {
            streamError = new TokenLimitException(messageData);
            return;
          } else if (messageData.status) {
            streamError = new Error(messageData.status);
            return;
          }

          this.logger.error('Error in querysolver WebSocket stream: ', messageData);
          streamError = new Error(messageData.message);
          return;
        }
        eventsQueue.push({ type: messageData.type, content: messageData.content });
      } catch (error) {
        this.logger.error('Error parsing querysolver WebSocket message', error);
      }
    };

    // call the querySolver websocket endpoint
    try {
      if (this.socketConn) {
        this.socketConn.onMessage.on('message', handleMessage);
        await this.socketConn.sendMessageWithRetry(finalPayload);
      }
    } catch (error: any) {
      this.logger.error('Error calling querySolver endpoint:', error);
      streamError = error;
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        this.dispose();
        streamDone = true;
      });
    }

    while (!streamDone || eventsQueue.length > 0) {
      if (streamError) {
        console.log('Error in querysolver WebSocket stream:', streamError);
        if (streamError instanceof Error && streamError.message === 'NOT_VERIFIED') {
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
          streamDone = false;
          streamError = null;
          if (!this.socketConn) {
            this.socketConn = this.backendClient.querySolver();
          }
          this.socketConn.onMessage.on('message', handleMessage);
          await this.socketConn.sendMessageWithRetry({
            ...finalPayload,
          });
          continue; // Retry the querySolver call
        }

        throw streamError;
      }
      if (signal?.aborted) {
        this.dispose();
        return;
      }

      if (eventsQueue.length > 0) {
        yield eventsQueue.shift()!;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Clean up the WebSocket connection
    // this.dispose();
  }

  public dispose(): void {
    if (this.socketConn) {
      try {
        console.log('Closing socket connection');
        this.socketConn.close();
      } catch (error) {
        this.logger.error('Error while closing socket connection:', error);
      } finally {
        this.socketConn = null;
      }
    }
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

export class ThrottlingException extends Error {
  public data: ThrottlingErrorData;
  constructor(data: ThrottlingErrorData) {
    super(data.message);
    this.name = 'ThrottlingException';
    this.data = data;

    Object.setPrototypeOf(this, ThrottlingException.prototype);
  }
}

export class TokenLimitException extends Error {
  public data: InputTokenLimitErrorData;
  constructor(data: InputTokenLimitErrorData) {
    super(data.message);
    this.name = 'TokenLimitException';
    this.data = data;

    Object.setPrototypeOf(this, TokenLimitException.prototype);
  }
}
