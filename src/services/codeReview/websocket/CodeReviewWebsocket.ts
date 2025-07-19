// ReviewService.ts
import * as vscode from 'vscode';
import { SingletonLogger } from '../../../utilities/Singleton-logger';
import { BackendClient } from '../../../clients/backendClient';
import { AgentPayload, ReviewEvent } from '../../../types';

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

  public async *startReview(
    payload: { review_id: number; agents: AgentPayload[] },
    signal?: AbortSignal,
  ): AsyncIterableIterator<ReviewEvent> {
    const eventsQueue: ReviewEvent[] = [];
    let socketError: Error | null = null;
    let messageData: ReviewEvent;

    try {
      this.currentSocket = this.backendClient.codeReviewSolver();
      if (!this.currentSocket) {
        throw new Error('Failed to create WebSocket connection');
      }

      const handleMessage = (data: ReviewEvent): void => {
        messageData = data;
        try {
          eventsQueue.push(data);
        } catch (error) {
          console.error('Error processing message:', error);
          eventsQueue.push({
            type: 'REVIEW_FAIL',
            agent_id: messageData?.agent_id,
          });
        }
      };

      const handleError = (error: Error): void => {
        console.error('WebSocket error:', error);
        socketError = error;
        eventsQueue.push({
          type: 'REVIEW_FAIL',
          agent_id: messageData?.agent_id,
        });
        this.currentSocket?.close();
      };

      const handleClose = (): void => {
        if (socketError) {
          eventsQueue.push({
            type: 'REVIEW_FAIL',
            agent_id: messageData?.agent_id,
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
