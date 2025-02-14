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
        const authToken = "***REMOVED***"
        return authToken
    }
}