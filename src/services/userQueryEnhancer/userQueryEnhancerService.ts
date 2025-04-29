import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";
import { ApiErrorHandler } from "../api/apiErrorHandler";
import { SESSION_TYPE } from "../../constants";
import { getSessionId, setSessionId } from "../../utilities/contextManager";

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

export class UserQueryEnhancerService {
  private apiErrorHandler = new ApiErrorHandler();

  public async generateEnhancedUserQuery(userQuery: string): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const sessionId = getSessionId();
      const headers = {
        "X-Session-ID": sessionId,
        Authorization: `Bearer ${authToken}`,
        "X-Session-Type": SESSION_TYPE,
      };
      const response = await api.post(API_ENDPOINTS.GENERATE_ENHANCED_USER_QUERY, { user_query: userQuery }, { headers });
      refreshCurrentToken(response.headers);
      if (response.data.data.session_id) {
        setSessionId(response.data.data.session_id);
      }
      return response.data.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
}