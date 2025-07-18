// ReviewService.ts
import * as vscode from 'vscode';
import { SingletonLogger } from '../../../utilities/Singleton-logger';
import { BackendClient } from '../../../clients/backendClient';
import { AgentPayload } from '../../../types';

export interface ReviewEvent {
  type: 'REVIEW_FAILED' | 'AGENT_START' | 'AGENT_COMPLETED' | 'AGENT_FAILED' | 'TOOL_USE_REQUEST';
  content?: any;
  error?: string;
  tool_use_id?: string;
  status?: string;
}

export class CodeReviewWebsocketService {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly context: vscode.ExtensionContext;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly backendClient: BackendClient;
  private currentSocket: any = null;

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

  public async *startReview(payload: { agents: AgentPayload[] }, signal?: AbortSignal): AsyncIterableIterator<ReviewEvent> {
    const eventsQueue: ReviewEvent[] = [];
    let socketError: Error | null = null;

    try {
      this.currentSocket = this.backendClient.codeReviewSolver();
      if (!this.currentSocket) {
        throw new Error('Failed to create WebSocket connection');
      }

      const handleMessage = (messageData: any): void => {
        try {
          console.log('review events sending', messageData);
          eventsQueue.push(messageData);
        } catch (error) {
          console.error('Error processing message:', error);
          eventsQueue.push({
            type: 'AGENT_FAILED',
            error: 'Failed to process message from server'
          });
        }
      };

      const handleError = (error: Error): void => {
        console.error('WebSocket error:', error);
        socketError = error;
        eventsQueue.push({
          type: 'REVIEW_FAILED',
          error: error.message || 'WebSocket connection error'
        });
        this.currentSocket?.close();
      };

      const handleClose = (): void => {
        if (socketError) {
          eventsQueue.push({
            type: 'REVIEW_FAILED',
            error: socketError.message || 'WebSocket connection closed with error'
          });
        }
      };

      this.currentSocket.onMessage.on('message', handleMessage);
      this.currentSocket.onError.on('error', handleError);
      this.currentSocket.onClose.on('close', handleClose);

      await this.currentSocket.sendMessageWithRetry(payload);

      if (signal) {
        signal.addEventListener('abort', () => {
          this.currentSocket?.close();
        });
      }

      while (true) {
        if (signal?.aborted) {
          this.currentSocket?.close();
          return;
        }

        if (socketError) {
          throw socketError;
        }

        if (eventsQueue.length > 0) {
          const event = eventsQueue.shift()!;
          if (event.type === 'AGENT_FAILED' && event.error) {
            throw new Error(event.error);
          }
          yield event;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      console.error('WebSocket error in startReview:', error);
      throw error; // Re-throw to be handled by the caller
    } finally {
      this.currentSocket?.close();
      this.currentSocket = null;
    }
  }

  public dispose(): void {
    if (this.currentSocket) {
      this.currentSocket.close();
      this.currentSocket = null;
    }
  }
}
