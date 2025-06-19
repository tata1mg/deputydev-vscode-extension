import { AuthService } from '../auth/AuthService';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { sendProgress } from '../../utilities/contextManager';
import { BinaryClient } from '../../clients/binaryClient';


export interface UpdateVectorStoreParams {
  repo_path: string;
  retried_by_user?: boolean;
  chunkable_files?: string[];
}

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};


class IndexingService {
  private readonly binaryClient: BinaryClient;

  constructor(binaryClient: BinaryClient) {
    this.binaryClient = binaryClient;
  }

  public async updateVectorStore(
    params: UpdateVectorStoreParams,
  ): Promise<{ status: string; error?: string }> {
    const authToken = await fetchAuthToken();
    const logger = SingletonLogger.getInstance();
    if (!authToken) {
      throw new Error('Authentication token is required while updating vector store.');
    }

    try {
      await this.binaryClient.updateVectorDB.sendMessageWithRetry(params);
      return { status: 'sent' };
    } catch (error: any) {
      logger.error('Error updating vector store:', error);
      return { status: 'failed', error: error.message };
    }
  }

  private handleIndexingEvents(messageData: any): void {
    try {
      if (messageData.status === 'In Progress') {
        sendProgress({
          repo: messageData.repo_path as string,
          progress: messageData.progress as number,
          status: messageData.status as string,
        });
      }

      // Check if the response is an object (update vector store)
      else if (messageData.status === 'Completed' || messageData.status === 'Failed') {
        sendProgress({
          repo: messageData.repo_path as string,
          progress: messageData.progress as number,
          status: messageData.status as string,
        });
        this.binaryClient.updateVectorDB.close();
      } else if (messageData.error_message) {
        this.binaryClient.updateVectorDB.close();
      } else {
        // console.warn("Received unknown message format:", messageData);
      }
    } catch (error) {
      // console.error("❌ Error parsing WebSocket message:", error);
      this.binaryClient.updateVectorDB.close();
    }
  };

  // Updated interface for UpdateVectorStoreParams (includes new backend field)
  public async updateVectorStoreWithResponse(params: UpdateVectorStoreParams): Promise<any> {

    // setup the handler for WebSocket events
    this.binaryClient.updateVectorDB.onMessage.on('message', (messageData: any) => {
      this.handleIndexingEvents(messageData);
    });


    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        // firstly, send the progress to indicate the start of the indexing process
        sendProgress({
          repo: params.repo_path,
          progress: 0,
          status: 'In Progress',
        });

        // then, let's send the trigger message to the binary WebSocket
        const triggerResult = await this.updateVectorStore(params);

        if (triggerResult.status === 'failed') {
          throw new Error('Failed to update vector store' + (triggerResult.error ? `: ${triggerResult.error}` : ''));
        }

        // If the update was successful, we can return the result
        return triggerResult;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) {
          sendProgress({
            repo: params.repo_path,
            progress: 0,
            status: 'Failed',
          });
          throw new Error(`Failed to update vector store after ${maxAttempts} attempts: ${error}`);
        }
      }
    }
  };
}
