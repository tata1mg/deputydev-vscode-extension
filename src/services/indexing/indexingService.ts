import { AuthService } from '../auth/AuthService';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { sendProgress } from '../../utilities/contextManager';
import { BinaryClient } from '../../clients/binaryClient';

export interface UpdateVectorStoreParams {
  repo_path: string;
  retried_by_user?: boolean;
  chunkable_files?: string[];
  sync?: boolean;
}

export class IndexingService {
  private readonly binaryClient: BinaryClient;

  constructor(binaryClient: BinaryClient) {
    this.binaryClient = binaryClient;
  }

  public async updateVectorStore(params: UpdateVectorStoreParams): Promise<{ status: string; error?: string }> {
    try {
      await this.binaryClient.updateVectorDB.sendMessageWithRetry(params);
      return { status: 'sent' };
    } catch (error: any) {
      return { status: 'failed', error: error.message };
    }
  }

  private handleIndexingEvents(
    messageData: any,
    resolver: (value: any) => void,
    rejecter: (reason?: any) => void,
  ): void {
    try {
      console.log('Received message from updateVectorDB:', messageData);
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

        const result = new Promise((resolve, reject) => {
          resolver = resolve;
          rejecter = reject;
        });

        this.binaryClient.updateVectorDB.onMessage.on('message', (messageData: any) => {
          console.log('Received message from updateVectorDB:', messageData);
          this.handleIndexingEvents(messageData, resolver, rejecter);
        });

        const triggerResult = await this.updateVectorStore({ ...params, sync: true });
        console.log(`Trigger result for repo: ${params.repo_path}:`, triggerResult);

        if (triggerResult.status === 'failed') {
          throw new Error('Failed to update vector store' + (triggerResult.error ? `: ${triggerResult.error}` : ''));
        }

        console.log(`Waiting for response from updateVectorDB for repo: ${params.repo_path}`);

        return await result;
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
