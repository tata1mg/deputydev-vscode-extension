import {
  relevantChunksSocket,
  updateVectorStoreSocket,
} from './websocketClient';
import * as vscode from 'vscode';

const authToken = vscode.ExtensionContext.context.globalState.get(data.key);

export interface RelevantChunksParams {
  repo_path: string;
  auth_token: string;
  query: string;
}

export interface UpdateVectorStoreParams {
  repo_path: string;
  auth_token: string;
}

export const fetchRelevantChunks = (params: RelevantChunksParams, authToken: string) => {
  relevantChunksSocket.send({
    ...params,
    auth_token: authToken, // Attach auth token manually
  });
};

export const updateVectorStore = (params: UpdateVectorStoreParams, authToken: string) => {
  updateVectorStoreSocket.send({
    ...params,
    auth_token: authToken, // Attach auth token manually
  });
};

export const subscribeToRelevantChunks = (callback: (data: any) => void) => {
  relevantChunksSocket.addEventListener('response', callback);
};

export const subscribeToVectorStoreUpdates = (
  callback: (data: any) => void
) => {
  updateVectorStoreSocket.addEventListener('response', callback);
};