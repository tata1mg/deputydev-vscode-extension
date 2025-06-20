import { sendEmbeddingDoneMessage, sendProgress } from '../../utilities/contextManager';
import { BinaryClient } from '../../clients/binaryClient';
import { BaseWebsocketEndpoint } from '../../clients/base/baseClient';

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
      const socketConn = this.binaryClient.updateVectorDB();
      await socketConn.sendMessageWithRetry(params);
      socketConn.close();
      return { status: 'sent' };
    } catch (error: any) {
      return { status: 'failed', error: error.message };
    }
  }

  private handleIndexingEvents(
    messageData: any,
    resolver: (value: any) => void,
    rejecter: (reason?: any) => void,
    socketConn: BaseWebsocketEndpoint
  ): void {
    try {
      if (messageData.task === 'EMBEDDING' && messageData.status === 'COMPLETED') {
        sendEmbeddingDoneMessage({
          task: messageData.task as string,
          status: messageData.status as string,
          repo_path: messageData.repo_path as string,
          progress: messageData.progress as number,
        });
        socketConn.close();
      } else if (messageData.task === 'INDEXING' && messageData.status === 'IN_PROGRESS') {
        sendProgress({
          task: messageData.task as string,
          status: messageData.status as string,
          repo_path: messageData.repo_path as string,
          progress: messageData.progress as number,
          indexing_status: messageData.indexing_status as { file_path: string; status: string }[],
          is_partial_state: messageData.is_partial_state as boolean,
        });
      } else if (messageData.task === 'INDEXING' && messageData.status === 'COMPLETED') {
        sendProgress({
          task: messageData.task as string,
          status: messageData.status as string,
          repo_path: messageData.repo_path as string,
          progress: messageData.progress as number,
          indexing_status: messageData.indexing_status as { file_path: string; status: string }[],
          is_partial_state: messageData.is_partial_state as boolean,
        });
        resolver({ status: 'completed' });
      } else if (messageData.task === 'INDEXING' && messageData.status === 'FAILED') {
        sendProgress({
          task: messageData.task as string,
          status: messageData.status as string,
          repo_path: messageData.repo_path as string,
          progress: messageData.progress as number,
          indexing_status: messageData.indexing_status as { file_path: string; status: string }[],
          is_partial_state: messageData.is_partial_state as boolean,
        });
        socketConn.close();
        rejecter(new Error('Indexing failed'));
      } else if (messageData.error_message) {
        socketConn.close();
        rejecter(new Error(messageData.error_message));
      }
    } catch (error) {
      socketConn.close();
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
          task: 'INDEXING',
          status: 'IN_PROGRESS',
          repo_path: params.repo_path,
          progress: 0,
          indexing_status: [],
          is_partial_state: false,
        });

        const result = new Promise((resolve, reject) => {
          resolver = resolve;
          rejecter = reject;
        });

        const socketConn = this.binaryClient.updateVectorDB();

        socketConn.onMessage.on('message', (messageData: any) => {
          this.handleIndexingEvents(messageData, resolver, rejecter, socketConn);
        });

        // Send the initial message to start the indexing process
        await socketConn.sendMessageWithRetry({...params, sync: true});

        return await result;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) {
          sendProgress({
            task: 'INDEXING',
            status: 'FAILED',
            repo_path: params.repo_path,
            progress: 0,
            indexing_status: [],
            is_partial_state: false,
          });
          throw new Error(`Failed to update vector store after ${maxAttempts} attempts: ${error}`);
        }
      }
    }
  }
}
