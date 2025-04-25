import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";
import { ApiErrorHandler } from "../api/apiErrorHandler";
import { SESSION_TYPE } from "../../constants";
import { getQueryId, getSessionId } from "../../utilities/contextManager";

const fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
  };

export class FeedbackService {
    private apiErrorHandler = new ApiErrorHandler();

    public async submitFeedback(feedback: string): Promise<any> {
        try {
          const authToken = await fetchAuthToken();
          const sessionId = getSessionId();
          const queryId = getQueryId();
          const headers = {
            "X-Session-ID": sessionId,
            Authorization: `Bearer ${authToken}`,
            "X-Session-Type": SESSION_TYPE,
            "X-Query-ID": queryId,
            "X-Feedback": feedback
          };
          const response = await api.post(
            API_ENDPOINTS.SUBMIT_FEEDBACK,
            {},
            { headers }
          );
          refreshCurrentToken(response.headers);
          console.log(response.data)
          return response.data;
        } catch (error) {
          this.apiErrorHandler.handleApiError(error);
        }
      }
}