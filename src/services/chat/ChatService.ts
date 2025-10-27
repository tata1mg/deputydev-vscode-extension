import * as vscode from 'vscode';
import { BackendClient } from '../../clients/backendClient';
import { SESSION_TYPE } from '../../constants';
import { ReferenceManager } from '../../references/ReferenceManager';
import { InputTokenLimitErrorData, ThrottlingErrorData } from '../../types';
import { getContextRepositories } from '../../utilities/contextManager';
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
  private sockets = new Map<string, BaseWebsocketEndpoint>();

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
      for await (const event of this._runQuerySolverAttempt(payload, payload.chatId, signal)) {
        firstAttemptYielded = true;
        yield event;
      }
    } catch (err) {
      if (!firstAttemptYielded) {
        this.logger.warn('querySolver failed...', err);
        await new Promise((res) => setTimeout(res, 200)); // small delay before retry
        for await (const event of this._runQuerySolverAttempt(payload, payload.chatId, signal)) {
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
    chatId: string,
    signal?: AbortSignal,
  ): AsyncIterableIterator<any> {
    const repositories = await getContextRepositories();

    // adding context of repositories present in workspace except active repository in payload.
    payload['repositories'] = repositories || [];
    const finalPayload = await this.preparePayload(payload);
    finalPayload.session_id = payload.sessionId;
    finalPayload.session_type = SESSION_TYPE;

    let streamDone = false;
    let streamError: Error | null = null;
    const eventsQueue: StreamEvent[] = [];
    let lastMessageId: string | null = null;
    let queryId: string | null = null;

    const handleMessage = (rawMessage: any): void => {
      console.log('Yielding event:', rawMessage);

      const messageData = rawMessage.data;
      const messageId = rawMessage.message_id;
      if (!messageData) {
        this.logger.error('Received WebSocket message without data', JSON.stringify(rawMessage));
        return;
      }

      if (messageId) {
        lastMessageId = messageId;
      }

      try {
        switch (messageData.type) {
          case 'STREAM_START':
            if (messageData.new_session_data) {
              refreshCurrentToken({ new_session_data: messageData.new_session_data });
            }
            eventsQueue.push({ type: messageData.type, content: messageData.content });
            break;

          case 'RESPONSE_METADATA':
            if (messageData.content?.query_id) queryId = messageData.content.query_id;
            eventsQueue.push({ type: messageData.type, content: messageData.content });
            break;

          case 'STREAM_END_CLOSE_CONNECTION':
          case 'STREAM_END':
            streamDone = true;
            return;

          case 'STREAM_ERROR':
            streamError = this.handleStreamError(messageData);
            return;

          default:
            eventsQueue.push({ type: messageData.type, content: messageData.content });
        }
      } catch (error) {
        this.logger.error('Error parsing querysolver WebSocket message', this.formatError(error));
      }
    };

    const setupSocketConnection = async (isReconnection = false): Promise<void> => {
      const socketConn = this.getOrCreateSocket(chatId, finalPayload.session_id);

      socketConn.onMessage.on('message', handleMessage);
      socketConn.onClose.on('close', (event: { code: number; reason: string }) => {
        this.handleSocketClose(chatId, event, streamDone, streamError, queryId, lastMessageId, setupSocketConnection);
      });

      const payloadToSend = isReconnection ? this.createResumptionPayload(queryId, lastMessageId) : finalPayload;

      await socketConn.sendMessageWithRetry(payloadToSend);

      if (isReconnection) {
        this.logger.info('Successfully sent resumption payload after reconnection');
      }
    };

    try {
      await setupSocketConnection();
    } catch (error: any) {
      this.logger.error('Error calling querySolver endpoint:', error);
      streamError = error;
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        this.closeSocket(chatId);
        streamError = null;
        streamDone = true;
      });
    }

    while (!streamDone || eventsQueue.length > 0) {
      if (streamError) {
        if (await this.handleAuthenticationRetry(chatId, streamError, finalPayload, handleMessage)) {
          streamDone = false;
          streamError = null;
          continue;
        }
        throw streamError;
      }

      if (signal?.aborted) {
        this.closeSocket(chatId);
        return;
      }

      if (eventsQueue.length > 0) {
        yield eventsQueue.shift()!;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  private handleStreamError(messageData: any): Error {
    if (messageData.status === 'LLM_THROTTLED') {
      return new ThrottlingException(messageData);
    } else if (messageData.status === 'INPUT_TOKEN_LIMIT_EXCEEDED') {
      return new TokenLimitException(messageData);
    } else if (messageData.status) {
      return new Error(messageData.status);
    }

    this.logger.error('Error in querysolver WebSocket stream: ', messageData);
    return new Error(messageData.message);
  }

  private createResumptionPayload(queryId: string | null, lastMessageId: string | null): Record<string, any> {
    if (!queryId) {
      throw new Error('Cannot create resumption payload: query_id is required but not available');
    }

    const resumptionPayload: Record<string, any> = {
      resume_query_id: queryId,
    };

    if (lastMessageId) {
      resumptionPayload.resume_offset_id = lastMessageId;
    }

    return resumptionPayload;
  }

  private async handleSocketClose(
    chatId: string,
    event: { code: number; reason: string },
    streamDone: boolean,
    streamError: Error | null,
    queryId: string | null,
    lastMessageId: string | null,
    setupSocketConnection: (isReconnection?: boolean) => Promise<void>,
  ): Promise<void> {
    this.logger.info(`WebSocket closed for chat ${chatId}:`, event);

    // Only attempt reconnection if the stream hasn't ended and there's no error
    if (!streamDone && !streamError) {
      this.logger.warn('WebSocket closed unexpectedly. Attempting to reconnect...');

      if (!queryId) {
        this.logger.error('Cannot reconnect: query_id not available for resumption');
        return;
      }

      try {
        // Clean up the old connection
        this.closeSocket(chatId);

        // Create new connection and send resumption payload
        await setupSocketConnection(true);
      } catch (err) {
        this.logger.error('Failed to reconnect and send resumption payload', err);
        // The error will be handled in the main loop
      }
    }
  }

  private async handleAuthenticationRetry(
    chatId: string,
    streamError: Error,
    finalPayload: Record<string, any>,
    handleMessage: (rawMessage: any) => void,
  ): Promise<boolean> {
    if (!(streamError instanceof Error) || streamError.message !== 'NOT_VERIFIED') {
      this.logger.error('Error in querysolver WebSocket stream:', streamError);
      return false;
    }

    let isAuthenticated = this.context.workspaceState.get('isAuthenticated');
    this.logger.info('Session not verified, waiting for authentication...', isAuthenticated);

    // Wait until the user is authenticated or timeout
    const startTime = Date.now();
    const maxWait = 10 * 60 * 1000; // 10 minutes

    while (!isAuthenticated && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      isAuthenticated = this.context.workspaceState.get('isAuthenticated');
    }

    if (!isAuthenticated) {
      throw new Error('Session not verified');
    }

    const socket = this.getOrCreateSocket(chatId, finalPayload.session_id);

    socket.onMessage.on('message', handleMessage);

    await socket.sendMessageWithRetry(finalPayload);

    return true;
  }

  private getOrCreateSocket(chatId: string, sessionId?: number): BaseWebsocketEndpoint {
    let socket = this.sockets.get(chatId);
    if (!socket) {
      this.logger.info(`Creating new socket for chat ${chatId}`);
      socket = this.backendClient.querySolver(sessionId);
      this.sockets.set(chatId, socket);
    }
    return socket;
  }

  public closeSocket(chatId: string): void {
    const socket = this.sockets.get(chatId);

    if (socket) {
      console.log('Closing socket for chatId:', chatId);
      this.logger.info(`Closing socket for chat ${chatId}`);

      try {
        socket.close();
      } catch (e) {
        this.logger.error(`Error closing socket for chat ${chatId}`, e);
      } finally {
        this.sockets.delete(chatId);
      }
    }
  }

  /**
   * Ensure the outbound WebSocket message is ≤100 KB; if it is larger,
   * off-load it to S3 and return a lightweight envelope.
   */
  private async preparePayload(original: Record<string, any>): Promise<Record<string, any>> {
    // ── 1. Measure size ──────────────────────────────────────────────────────────────────────────
    const serialised = JSON.stringify(original);
    const byteSize = Buffer.byteLength(serialised, 'utf8');
    const mainConfigData = this.context.workspaceState.get('configData') as any;
    const CHAT_PAYLOAD_MAX_SIZE = mainConfigData.CHAT_PAYLOAD_MAX_SIZE * 1024 || 100 * 1024; // Default to 100 KB if not set
    if (byteSize <= CHAT_PAYLOAD_MAX_SIZE) {
      return original;
    }

    // ── 2. Too big → store in S3 (folder: 'payload') ────────────────────────────
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
  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return `${err.name}: ${err.message}\n${err.stack ?? ''}`;
    }

    if (typeof err === 'object' && err !== null) {
      return JSON.stringify(err, Object.getOwnPropertyNames(err));
    }

    return String(err);
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
