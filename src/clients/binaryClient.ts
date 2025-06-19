import { AuthService } from '../services/auth/AuthService';
import { BaseClient, BaseWebsocketEndpoint } from './base/baseClient';

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

const getAuthorizationHeader = async () => {
  const authToken = await fetchAuthToken();
  return {
    Authorization: `Bearer ${authToken}`,
  };
};

export class BinaryClient extends BaseClient {
  // Default endpoints can be set here if needed
  endpointMap: Record<string, string> = {
    UPDATE_VECTOR_DB: '/v1/update_chunks',
    GET_RELEVANT_CHUNKS: '/v1/relevant_chunks',
  };

  // endpoints
  public updateVectorDB!: BaseWebsocketEndpoint;
  public getRelevantChunks!: BaseWebsocketEndpoint;

  constructor(httpHost?: string, wsHost?: string, endpointsMap: Record<string, string> = {}) {
    super(httpHost, wsHost, getAuthorizationHeader);
    this.endpointMap = { ...this.endpointMap, ...endpointsMap };
    this.initEndpoints();
  }

  initEndpoints() {
    this.updateVectorDB = this.createWebsocketEndpoint(this.endpointMap['UPDATE_VECTOR_DB']);
    this.getRelevantChunks = this.createWebsocketEndpoint(this.endpointMap['GET_RELEVANT_CHUNKS']);
  }
}
