import { API_ENDPOINTS } from '../services/api/endpoints';
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
  // endpoints
  public updateVectorDB!: () => BaseWebsocketEndpoint;
  public semanticSearch!: () => BaseWebsocketEndpoint;

  constructor(httpHost?: string, wsHost?: string) {
    super(httpHost, wsHost, undefined, getAuthorizationHeader);
    this.initEndpoints();
  }

  initEndpoints() {
    this.updateVectorDB = this.createWebsocketEndpoint(API_ENDPOINTS.UPDATE_VECTOR_DB);
    this.semanticSearch = this.createWebsocketEndpoint(API_ENDPOINTS.SEMANTIC_SEARCH);
  }
}
