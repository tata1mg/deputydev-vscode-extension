import { api } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { AuthService } from '../auth/AuthService';
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { SESSION_TYPE } from '../../constants';
import { getSessionId, setSessionId } from '../../utilities/contextManager';
import { ErrorTrackingManager } from '../../analyticsTracking/ErrorTrackingManager';

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

export class UserQueryEnhancerService {
  private apiErrorHandler = new ApiErrorHandler();
  constructor(private errorTrackingManager: ErrorTrackingManager) {}

  public async generateEnhancedUserQuery(userQuery: string, sessionId: number | undefined): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        'X-Session-ID': sessionId,
        Authorization: `Bearer ${authToken}`,
        'X-Session-Type': SESSION_TYPE,
      };
      const response = await api.post(
        API_ENDPOINTS.GENERATE_ENHANCED_USER_QUERY,
        { user_query: userQuery },
        { headers },
      );
      refreshCurrentToken(response.headers);
      return response.data.data;
    } catch (error) {
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'QUERY_ENHANCER_API_ERROR',
        errorSource: 'BACKEND',
        sessionId: sessionId,
      });
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }
}
