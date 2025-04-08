import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";
import { ApiErrorHandler } from "../api/apiErrorHandler";
import { SESSION_TYPE } from "../../constants";
import { SingletonLogger } from "../../utilities/Singleton-logger";

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

export class HistoryService {
  private apiErrorHandler = new ApiErrorHandler();

  public async getPastSessions(
    limit: number,
    offset: number,
    sessions_list_type: string
  ): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await api.get(API_ENDPOINTS.PAST_SESSIONS, {
        params: {
          limit,
          offset,
          sessions_list_type,
          session_type: SESSION_TYPE,
        },
        headers,
      });
      refreshCurrentToken(response.headers);
      return response.data.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async reorderPinnedSessions(data: Record<number, number>) {
    console.log("Reordering pinned sessions", data);
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await api.put(
        API_ENDPOINTS.REORDER_PINNED_SESSIONS,
        data,
        { headers }
      );
      refreshCurrentToken(response.headers);
      return response.data.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async getPastSessionChats(sessionId: number): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        "X-Session-ID": sessionId,
        Authorization: `Bearer ${authToken}`,
        "X-Session-Type": SESSION_TYPE,
      };
      const response = await api.get(API_ENDPOINTS.PAST_CHATS, {
        headers,
      });
      refreshCurrentToken(response.headers);
      return response.data.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async deleteSession(sessionId: number): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        "X-Session-ID": sessionId,
        Authorization: `Bearer ${authToken}`,
        "X-Session-Type": SESSION_TYPE,
      };
      const response = await api.put(
        API_ENDPOINTS.DELETE_SESSION,
        {},
        { headers }
      );
      refreshCurrentToken(response.headers);
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async pinOrUnpinSession(data: {
    sessionId: number;
    pin_or_unpin: string;
    rank?: number;
  }): Promise<any> {
    console.log("Pinning/Unpinning session", {
      sessions_list_type: data.pin_or_unpin,
      pinned_rank: data.rank,
    });
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        "X-Session-ID": data.sessionId,
        "Authorization": `Bearer ${authToken}`,
        "X-Session-Type": SESSION_TYPE,
      };
      const response = await api.put(
        API_ENDPOINTS.PIN_UNPIN_SESSION,
        {},
        {
          headers, params: {
            sessions_list_type: data.pin_or_unpin,
            pinned_rank: data.rank,
          }
        }
      );
      refreshCurrentToken(response.headers);
      return response.data.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async getRelevantChatHistory(
    sessionId: number,
    query: string
  ): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        "X-Session-ID": sessionId,
        Authorization: `Bearer ${authToken}`,
        "X-Session-Type": SESSION_TYPE,
      };
      const response = await api.post(
        API_ENDPOINTS.RELEVANT_CHAT_HISTORY,
        {
          query,
        },
        { headers }
      );
      refreshCurrentToken(response.headers);
      return response.data.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
