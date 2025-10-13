import { ErrorTrackingManager } from '../../analyticsTracking/ErrorTrackingManager';
import { SESSION_TYPE } from '../../constants';
import { getSessionId } from '../../utilities/contextManager';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { api } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { AuthService } from '../auth/AuthService';
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

export class FeedbackService {
  private apiErrorHandler = new ApiErrorHandler();
  private errorTrackingManager = new ErrorTrackingManager();

  public async submitFeedback(feedback: string, queryId: number, sessionId: number): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        'X-Session-ID': sessionId,
        Authorization: `Bearer ${authToken}`,
        'X-Session-Type': SESSION_TYPE,
        'X-Query-ID': queryId,
        'X-Feedback': feedback,
      };
      const response = await api.post(API_ENDPOINTS.SUBMIT_FEEDBACK, {}, { headers });
      refreshCurrentToken(response.headers);
      return response.data;
    } catch (error) {
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'FEEDBACK_API_ERROR',
        errorSource: 'BACKEND',
        sessionId: sessionId,
      });
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
