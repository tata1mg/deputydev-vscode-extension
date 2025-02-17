import { relevantChunksSocket, updateVectorStoreSocket } from "./websocketClient";


export interface RelevantChunksParams {
    repo_path: string;
    auth_token: string;
    query: string;
}

export interface UpdateVectorStoreParams {
    repo_path: string;
    auth_token: string;
}


// Function to send query to relevant_chunks WebSocket
export const fetchRelevantChunks = (params: RelevantChunksParams) => {
    relevantChunksSocket.send(params);
};

// Function to update vector store
export const updateVectorStore = (params: UpdateVectorStoreParams) => {
    updateVectorStoreSocket.send(params);
};
