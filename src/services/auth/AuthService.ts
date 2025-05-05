import { api, binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { getBinaryHost } from '../../config';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { SingletonLogger } from '../../utilities/Singleton-logger';

export class AuthService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  // create a construcuter with logger
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();

  public async getSession(supabaseSessionId: string): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      'X-Supabase-Session-Id': supabaseSessionId,
    };
    try {
      const response = await api.get(API_ENDPOINTS.GET_SESSION, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching session during getSession');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async verifyAuthToken(authToken: string): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };
    try {
      const response = await api.post(API_ENDPOINTS.VERIFY_AUTH_TOKEN, {}, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error verifying auth token during verifyAuthToken');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async storeAuthToken(authToken: string): Promise<any> {
    const headers = {
      Authorization: `Bearer ${authToken}`,
    };
    try {
      const response = await binaryApi().post(API_ENDPOINTS.STORE_AUTH_TOKEN, {}, { headers });
      if (response.data.message === 'success') {
        return 'success';
      } else {
        return 'failed';
      }
    } catch (error) {
      this.logger.error('Error storing auth token during storing Auth Token');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async loadAuthToken() {
    try {
      const response = await binaryApi().get(API_ENDPOINTS.LOAD_AUTH_TOKEN);
      if (response.data.message === 'success' && response.data.auth_token) {
        return response.data.auth_token;
      } else {
        return null;
      }
    } catch (error) {
      this.logger.error('Error loading auth token during loading Auth Token');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async deleteAuthToken() {
    try {
      const response = await binaryApi().post(API_ENDPOINTS.DELETE_AUTH_TOKEN);
      if (response.data.message === 'success') {
        return response.data.message;
      }
    } catch (error) {
      this.logger.error('Error deleting auth token during deleting Auth Token');
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
