import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { api, binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export class AuthService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  // create a construcuter with logger
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();

  public async getSession(uniqueSessionId: string): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      'X-Unique-Session-Id': uniqueSessionId,
    };
    try {
      const response = await api.get(API_ENDPOINTS.GET_SESSION, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching session during getSession');
      this.apiErrorHandler.handleApiError(error);
      throw error;
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
      throw error;
    }
  }

  public async storeAuthToken(authToken: string): Promise<'success' | 'failed'> {
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
      return 'failed';
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
      throw error;
    }
  }

  public async deleteAuthToken(): Promise<'success' | 'failed'> {
    try {
      const response = await binaryApi().post(API_ENDPOINTS.DELETE_AUTH_TOKEN);
      if (response.data.message === 'success') {
        return response.data.message;
      }
    } catch (error) {
      this.logger.error('Error deleting auth token during deleting Auth Token');
      this.apiErrorHandler.handleApiError(error);
      return 'failed';
    }
    return 'failed';
  }
}
