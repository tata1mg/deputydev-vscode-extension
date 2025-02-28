import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";

export class HistoryService {
    public async getPastSessions(): Promise<any> {
        try {
            const response = await api.get(API_ENDPOINTS.PAST_SESSIONS);
            // console.log("past sessions response", response.data.data)
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async getPastSessionChats(sessionId: number): Promise<any> {
        const headers = {
            "X-Session-Id" : sessionId
        };
        try {
            const response = await api.get(API_ENDPOINTS.PAST_CHATS, {
                headers
            });
            // console.log("past sessions response", response.data.data)
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async deleteSession(sessionId: number): Promise<any> {
        try {
            const response = await api.put(API_ENDPOINTS.DELETE_SESSION, {
                sessionId : sessionId
            });
            return response.data;
        } catch (error) {
            console.error('Error while deleting session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }
}