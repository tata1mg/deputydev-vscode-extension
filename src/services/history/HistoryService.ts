import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";

export class HistoryService {
    public async getPastSessions(limit: number, offset: number): Promise<any> {
        try {
            const response = await api.get(API_ENDPOINTS.PAST_SESSIONS, {
                params: {
                    limit,
                    offset,
                    session_type: "CODE_GENERATION_V2"
                }
            });
            // console.log("past sessions response", response.data.data)
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async getPastSessionChats(sessionId: number): Promise<any> {
        const headers = {
            "X-Session-ID" : sessionId
        };
        try {
            const response = await api.get(API_ENDPOINTS.PAST_CHATS, {
                headers
            });
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async deleteSession(sessionId: number): Promise<any> {
        const headers = {
            "X-Session-ID" : sessionId
        };
        try {
            const response = await api.put(API_ENDPOINTS.DELETE_SESSION, {}, {headers});
            return response.data;
        } catch (error) {
            console.error('Error while deleting session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async getRelevantChatHistory(sessionId: number, query: string): Promise<any> {
        const headers = {
            "X-Session-ID" : sessionId
        };
        try {
            const response = await api.post(API_ENDPOINTS.RELEVANT_CHAT_HISTORY, {
                query
            }, {headers});
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }
}