import { BaseWebsocketEndpoint } from '../../../clients/base/baseClient';
import { BinaryClient } from '../../../clients/binaryClient';

interface SemanticSearchParams {
  repo_path: string;
  query: string;
  explanation: string;
  session_id: number;
  session_type: string;
  focus_directories?: string[];
  perform_chunking?: boolean;
}

export class SemanticSearchToolService {
  private binaryClient!: BinaryClient;

  public init(binaryClient: BinaryClient): void {
    this.binaryClient = binaryClient;
  }

  private readRelevantChunkResponse(
    messageData: any,
    resolver: (value: any) => void,
    rejector: (reason?: any) => void,
    socketConn: BaseWebsocketEndpoint,
  ): void {
    try {
      // Check if the response is an array (relevant chunks)
      // Check if response has relevant_chunks key
      if (messageData.relevant_chunks && Array.isArray(messageData.relevant_chunks)) {
        resolver(messageData);
        socketConn.close();
      } else {
        rejector(new Error('Unexpected response format'));
        socketConn.close();
      }
    } catch (error) {
      rejector(error);
      socketConn.close();
    }
  }

  public async runTool(params: SemanticSearchParams): Promise<any> {
    let resolver: (value: any) => void;
    let rejector: (reason?: any) => void;

    const result = new Promise((resolve, reject) => {
      resolver = resolve;
      rejector = reject;
    });

    const socketConn = this.binaryClient.semanticSearch();

    socketConn.onMessage.on('message', (messageData: any) => {
      this.readRelevantChunkResponse(messageData, resolver, rejector, socketConn);
    });
    await socketConn.sendMessageWithRetry(params);
    return await result;
  }
}
