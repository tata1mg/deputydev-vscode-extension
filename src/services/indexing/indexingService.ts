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
  private binaryClient!: BinaryClient;

  public init(binaryClient: BinaryClient): void {
    this.binaryClient = binaryClient;
  }

  private handleIndexingEvents(
    messageData: any,
    resolver: (value: any) => void,
    rejecter: (reason?: any) => void,
    socketConn: BaseWebsocketEndpoint,
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
        });
      } else if (messageData.task === 'INDEXING' && messageData.status === 'COMPLETED') {
        sendProgress({
          task: messageData.task as string,
          status: messageData.status as string,
          repo_path: messageData.repo_path as string,
          progress: messageData.progress as number,
          indexing_status: messageData.indexing_status as { file_path: string; status: string }[],
        });
        resolver({ status: 'completed' });
      } else if (messageData.task === 'INDEXING' && messageData.status === 'FAILED') {
        sendProgress({
          task: messageData.task as string,
          status: messageData.status as string,
          repo_path: messageData.repo_path as string,
          progress: messageData.progress as number,
          indexing_status: messageData.indexing_status as { file_path: string; status: string }[],
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

  public async updateVectorStore(params: UpdateVectorStoreParams): Promise<any> {
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
        await socketConn.sendMessageWithRetry({ ...params, sync: true });

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
          });
          throw new Error(`Failed to update vector store after ${maxAttempts} attempts: ${error}`);
        }
      }
    }
  }
}
