import { BinaryClient } from '../../../clients/binaryClient';

interface RelevantChunksParams {
  repo_path: string;
  query: string;
  focus_chunks?: string[];
  focus_files?: string[];
  focus_directories?: string[];
  perform_chunking?: boolean;
  session_id?: number;
  session_type?: string;
}

export class RelevantCodeSearcherToolService {
  private readonly binaryClient: BinaryClient;

  constructor(binaryClient: BinaryClient) {
    this.binaryClient = binaryClient;
  }

  private readRelevantChunkResponse(
    messageData: any,
    resolver: (value: any) => void,
    rejector: (reason?: any) => void,
  ): void {
    try {
      // Check if the response is an array (relevant chunks)
      // Check if response has relevant_chunks key
      if (messageData.relevant_chunks && Array.isArray(messageData.relevant_chunks)) {
        resolver(messageData);
        this.binaryClient.getRelevantChunks.close();
      } else {
        rejector(new Error('Unexpected response format'));
        this.binaryClient.getRelevantChunks.close();
      }
    } catch (error) {
      rejector(error);
      this.binaryClient.getRelevantChunks.close();
    }
  }

  public async runTool(params: RelevantChunksParams): Promise<any> {
    let resolver: (value: any) => void;
    let rejector: (reason?: any) => void;

    const result = new Promise((resolve, reject) => {
      resolver = resolve;
      rejector = reject;
    });

    this.binaryClient.getRelevantChunks.onMessage.on('message', (messageData: any) => {
      this.readRelevantChunkResponse(messageData, resolver, rejector);
    });
    await this.binaryClient.getRelevantChunks.sendMessageWithRetry(params);
    return result;
  }
}
