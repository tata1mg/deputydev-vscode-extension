import {
  relevantChunksSocket,
  updateVectorStoreSocket,
} from './websocketClient';
import { getAuthToken } from '../../utilities/contextManager';



export interface RelevantChunksParams {
  repo_path: string;
  query: string;
}

export interface UpdateVectorStoreParams {
  repo_path: string;
  files_updated? : string[];
}

const fetchAuthToken = (): string | null => {
  const authToken = getAuthToken();
  if (!authToken) {
    console.error('[WebSocket] Missing auth token. Ensure user is logged in.');
    return null;
  }
  return authToken;
};


/**
 * Helper function to safely send a message via WebSocket
 */


export const fetchRelevantChunks = (params: RelevantChunksParams) => {
  const authToken = fetchAuthToken();
  
  relevantChunksSocket.send({
    ...params,
    auth_token: authToken,
  });
};

export const updateVectorStore = (params: UpdateVectorStoreParams) => {
  const authToken = fetchAuthToken();
  console.log('updateVectorStore is there: ', params);
  updateVectorStoreSocket.send({
    ...params,
    auth_token: authToken,
  });
};

export const subscribeToRelevantChunks = (callback: (data: any) => void) => {
  relevantChunksSocket.addEventListener('response', callback);
};

export const subscribeToVectorStoreUpdates = (callback: (data: any) => void) => {
  updateVectorStoreSocket.addEventListener('response', callback);
};
