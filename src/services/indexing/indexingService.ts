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

export class IndexingService {
  private readonly binaryClient: BinaryClient;

  constructor(binaryClient: BinaryClient) {
    this.binaryClient = binaryClient;
  }

  public async updateVectorStore(params: UpdateVectorStoreParams): Promise<{ status: string; error?: string }> {
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

  private handleIndexingEvents(
    messageData: any,
    resolver: (value: any) => void,
    rejecter: (reason?: any) => void,
  ): void {
    try {
      if (messageData.status === 'In Progress') {
        sendProgress({
          repo: messageData.repo_path as string,
          progress: messageData.progress as number,
          status: messageData.status as string,
        });
      } else if (messageData.status === 'Completed') {
        sendProgress({
          repo: messageData.repo_path as string,
          progress: messageData.progress as number,
          status: messageData.status as string,
        });
        this.binaryClient.updateVectorDB.close();
        resolver({ status: 'completed' });
      } else if (messageData.status === 'Failed') {
        sendProgress({
          repo: messageData.repo_path as string,
          progress: messageData.progress as number,
          status: messageData.status as string,
        });
        this.binaryClient.updateVectorDB.close();
        rejecter(new Error('Indexing failed'));
      } else if (messageData.error_message) {
        this.binaryClient.updateVectorDB.close();
        rejecter(new Error(messageData.error_message));
      }
    } catch (error) {
      this.binaryClient.updateVectorDB.close();
      rejecter(error);
    }
  }

  public async updateVectorStoreWithResponse(params: UpdateVectorStoreParams): Promise<any> {
    let resolver: (value: any) => void;
    let rejecter: (reason?: any) => void;

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        sendProgress({
          repo: params.repo_path,
          progress: 0,
          status: 'In Progress',
        });

        const triggerResult = await this.updateVectorStore(params);

        if (triggerResult.status === 'failed') {
          throw new Error('Failed to update vector store' + (triggerResult.error ? `: ${triggerResult.error}` : ''));
        }

        const result = await new Promise((resolve, reject) => {
          resolver = resolve;
          rejecter = reject;
        });

        this.binaryClient.updateVectorDB.onMessage.on('message', (messageData: any) => {
          this.handleIndexingEvents(messageData, resolver, rejecter);
        });

        return result;
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
  }
}
