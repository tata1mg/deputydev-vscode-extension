import api from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";

export class AuthService {
    public async getSession(supabaseSessionId: string): Promise<any> {
        const headers = {
            "Content-Type": "application/json",
            "X-Supabase-Session-Id": supabaseSessionId
        };
        try {
            const response = await api.get(API_ENDPOINTS.GETSESSION, { headers });
            return response.data;
        } catch (error) {
            console.error('Error while fetching session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async verifyAuthToken(authToken: string): Promise<any> {
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
        }
        try {
            const response = await api.post(API_ENDPOINTS.VERIFYAUTHTOKEN, {}, { headers });
            return response.data;
        } catch (error) {
            console.error('Error while verifying current session:', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async storeAuthToken(authToken: string): Promise<any> {
        return "success"
    }

    public async loadAuthToken() {
        const authToken = "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"
        return authToken
    }
}