// ReviewService.ts
import * as vscode from 'vscode';
import { SingletonLogger } from '../../../utilities/Singleton-logger';
import { BackendClient } from '../../../clients/backendClient';
import { AgentPayload, ReviewEvent, PostProcessEvent } from '../../../types';
import { getReviewSessionId } from '../../../utilities/contextManager';
import { SESSION_TYPE } from '../../../constants';
import { AuthService } from '../../auth/AuthService';

export class CodeReviewWebsocketService {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly context: vscode.ExtensionContext;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly backendClient: BackendClient;
  private reviewSocket: any = null;
  private postProcessSocket: any = null;
  private eventsQueue: Array<ReviewEvent> = [];
  private postProcessEventQueue: Array<PostProcessEvent> = [];

  constructor(context: vscode.ExtensionContext, outputChannel: vscode.LogOutputChannel, backendClient: BackendClient) {
    this.logger = SingletonLogger.getInstance();
    this.outputChannel = outputChannel;
    this.context = context;
    this.backendClient = backendClient;
    const configData = this.context.workspaceState.get('essentialConfigData');
    if (!configData) {
      throw new Error('Config data not found in workspace state');
    }
  }

  public async *startReview(payload: Record<string, any>, signal?: AbortSignal): AsyncIterableIterator<ReviewEvent> {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();

    // Adding essential data in payload
    payload['session_id'] = getReviewSessionId();
    payload['session_type'] = SESSION_TYPE;
    payload['auth_token'] = authToken;
    payload['action'] = 'run-agent';

    let socketError: Error | null = null;
    let messageData: ReviewEvent;

    try {
      this.reviewSocket = this.backendClient.codeReviewSolver();
      if (!this.reviewSocket) {
        throw new Error('Failed to create WebSocket connection');
      }

      const handleMessage = (data: ReviewEvent): void => {
        messageData = data;
        try {
          this.eventsQueue.push(data);
        } catch (error) {
          console.error('Error processing message:', error);
          this.eventsQueue.push({
            type: 'REVIEW_FAIL',
            agent_id: messageData?.agent_id,
          });
        }
      };

      const handleError = (error: Error): void => {
        console.error('WebSocket error:', error);
        socketError = error;
        this.eventsQueue.push({
          type: 'REVIEW_FAIL',
          agent_id: messageData?.agent_id,
        });
        this.dispose();
      };

      const handleClose = (): void => {
        if (socketError) {
          this.eventsQueue.push({
            type: 'REVIEW_FAIL',
            agent_id: messageData?.agent_id,
          });
        }
      };

      this.reviewSocket.onMessage.on('message', handleMessage);
      this.reviewSocket.onError.on('error', handleError);
      this.reviewSocket.onClose.on('close', handleClose);

      await this.reviewSocket.sendMessageWithRetry(payload);

      if (signal) {
        signal.addEventListener('abort', () => {
          this.dispose();
        });
      }

      while (true) {
        if (signal?.aborted) {
          this.dispose();
          return;
        }

        if (socketError) {
          throw socketError;
        }

        if (this.eventsQueue.length > 0) {
          const event = this.eventsQueue.shift()!;
          // if (event.data) {
          //   throw new Error(event.data);
          // }
          yield event;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      console.error('WebSocket error in startReview:', error);
      throw error; // Re-throw to be handled by the caller
    } finally {
      this.dispose();
    }
  }

  public async *startPostProcess(
    payload: Record<string, any>,
    signal?: AbortSignal,
  ): AsyncIterableIterator<PostProcessEvent> {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();

    // Adding essential data in payload
    payload['session_id'] = getReviewSessionId();
    payload['session_type'] = SESSION_TYPE;
    payload['auth_token'] = authToken;
    payload['action'] = 'post-process';
    let socketError: Error | null = null;

    try {
      this.postProcessSocket = this.backendClient.postProcessSolver();
      if (!this.postProcessSocket) {
        throw new Error('Failed to create WebSocket connection');
      }

      const handleMessage = (data: PostProcessEvent): void => {
        try {
          this.postProcessEventQueue.push(data);

          // Close connection if STREAM_END or POST_PROCESS_ERROR is received
          if (data.type === 'STREAM_END') {
            this.dispose();
          }
        } catch (error) {
          console.error('Error processing message:', error);
          this.postProcessEventQueue.push({
            type: 'POST_PROCESS_ERROR',
            agent_id: null,
            data: {
              message: 'Error processing message',
              result: { status: 'Error' },
            },
            timestamp: new Date().toISOString(),
          });
          this.dispose();
        }
      };

      const handleError = (error: Error): void => {
        console.error('WebSocket error:', error);
        socketError = error;
        this.postProcessEventQueue.push({
          type: 'POST_PROCESS_ERROR',
          agent_id: null,
          data: {
            message: error.message,
            result: { status: 'Error' },
          },
          timestamp: new Date().toISOString(),
        });
        this.dispose();
      };

      this.postProcessSocket.onMessage.on('message', handleMessage);
      this.postProcessSocket.onError.on('error', handleError);

      // Start the post process with review_id
      await this.postProcessSocket.sendMessageWithRetry(payload);

      if (signal) {
        signal.addEventListener('abort', () => {
          this.dispose();
        });
      }

      while (true) {
        if (signal?.aborted) {
          this.dispose();
          return;
        }

        if (socketError) {
          throw socketError;
        }

        if (this.postProcessEventQueue.length > 0) {
          const event = this.postProcessEventQueue.shift()!;
          yield event;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      console.error('WebSocket error in startPostProcess:', error);
      throw error;
    } finally {
      this.dispose();
    }
  }

  public dispose(): void {
    if (this.reviewSocket) {
      console.log('Closing review socket');
      this.reviewSocket.close();
      this.reviewSocket = null;
    }
    if (this.postProcessSocket) {
      console.log('Closing post process socket');
      this.postProcessSocket.close();
      this.postProcessSocket = null;
    }
  }
}
