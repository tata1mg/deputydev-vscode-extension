import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";


const fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
};

export class HistoryService {
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
            throw error; // Throw the error to be handled by the caller
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
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
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
            console.error('Error while deleting session:', error);
            throw error; // Throw the error to be handled by the caller
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
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }
}