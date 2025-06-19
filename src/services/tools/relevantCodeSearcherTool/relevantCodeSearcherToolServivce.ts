import { WebSocketClient } from '../../../clients/common/websocketClient';
import { getBinaryWsHost } from '../../../config';
import { SingletonLogger } from '../../../utilities/Singleton-logger';
import { API_ENDPOINTS } from '../../api/endpoints';
import { AuthService } from '../../auth/AuthService';


const handleIndexingEvents = (messageData: any) => {
  try {
    // Check if the response is an array (relevant chunks)
    // Check if response has relevant_chunks key
    if (messageData.relevant_chunks && Array.isArray(messageData.relevant_chunks)) {
      this.resolveResponse(messageData);
      this.close();
    } else if (messageData.status === 'In Progress') {
      sendProgress({
        repo: messageData.repo_path as string,
        progress: messageData.progress as number,
        status: messageData.status as string,
      });
    }
    // Check if the response is an object (update vector store)
    else if (messageData.status === 'Completed') {
      sendProgress({
        repo: messageData.repo_path as string,
        progress: messageData.progress as number,
        status: messageData.status as string,
      });
      this.resolveResponse(messageData.status);
      this.close();
    } else if (messageData.status === 'Failed') {
      sendProgress({
        repo: messageData.repo_path as string,
        progress: messageData.progress as number,
        status: messageData.status as string,
      });
      this.rejectResponse(new Error('WebSocket request timed out'));
      this.close();
    } else if (messageData.error_message) {
      this.rejectResponse(new Error(messageData.error_message));
      this.close();
    } else {
      // console.warn("Received unknown message format:", messageData);
    }
  } catch (error) {
    // console.error("❌ Error parsing WebSocket message:", error);
    this.rejectResponse(error);
    this.close();
  }
};


/**
 * Fetch relevant chunks using WebSocket in a request–response pattern.
 * @param params Parameters for the request.
 * @returns Promise resolving to the response data.
 */

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

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};


export const fetchRelevantChunks = async (params: RelevantChunksParams): Promise<any> => {
  const authToken = await fetchAuthToken();
  const logger = SingletonLogger.getInstance();
  if (!authToken) {
    throw new Error('Authentication token is required');
  }
  const Websocket_host = getBinaryWsHost();
  // console.log("websocket host:", Websocket_host);
  const client = new WebSocketClient(Websocket_host, API_ENDPOINTS.RELEVANT_CHUNKS, authToken);
  try {
    return await client.send({
      ...params,
    });
  } catch (error) {
    logger.error('Error fetching relevant chunks');
    // console.error("Error fetching relevant chunks:", error);
    throw error;
  } finally {
    client.close();
  }
};