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
            console.log("response", response)
            return response.data;
        } catch (error) {
            console.log('Error fetching session:', error);
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
            console.log("response", response)
            return response.data;
        } catch (error) {
            console.log('Error fetching session:', error);
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