import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";
import { ApiErrorHandler } from "../api/apiErrorHandler";

const fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
};

export class HistoryService {
    private apiErrorHandler = new ApiErrorHandler();

    public async getPastSessions(limit: number, offset: number): Promise<any> {
        try {
            const authToken = await fetchAuthToken();
            const headers = {
                "Authorization": `Bearer ${authToken}`
            }
            const response = await api.get(API_ENDPOINTS.PAST_SESSIONS, {
                params: {
                    limit,
                    offset,
                    session_type: "CODE_GENERATION_V2",
                }, headers
            });
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
                "Authorization": `Bearer ${authToken}`
            };
            const response = await api.get(API_ENDPOINTS.PAST_CHATS, {
                headers
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
                "Authorization": `Bearer ${authToken}`
            };
            const response = await api.put(API_ENDPOINTS.DELETE_SESSION, {}, { headers });
            refreshCurrentToken(response.headers);
            return response.data;
        } catch (error) {
            this.apiErrorHandler.handleApiError(error);
        }
    }

    public async getRelevantChatHistory(sessionId: number, query: string): Promise<any> {
        try {
            const authToken = await fetchAuthToken();
            const headers = {
                "X-Session-ID": sessionId,
                "Authorization": `Bearer ${authToken}`
            };
            const response = await api.post(API_ENDPOINTS.RELEVANT_CHAT_HISTORY, {
                query
            }, { headers });
            refreshCurrentToken(response.headers);
            return response.data.data;
        } catch (error) {
            this.apiErrorHandler.handleApiError(error);
        }
    }
}