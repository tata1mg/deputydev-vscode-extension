import { get } from "lodash";
import { api, binaryApi } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { getBinaryHost } from "../../config";

export class AuthService {
    public async getSession(supabaseSessionId: string): Promise<any> {
        const headers = {
            "Content-Type": "application/json",
            "X-Supabase-Session-Id": supabaseSessionId
        };
        try {
            const response = await api.get(API_ENDPOINTS.GET_SESSION, { headers });
            return response.data;
        } catch (error) {
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async verifyAuthToken(authToken: string): Promise<any> {
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
        }
        try {
            const response = await api.post(API_ENDPOINTS.VERIFY_AUTH_TOKEN, {}, { headers });
            return response.data;
        } catch (error) {
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async storeAuthToken(authToken: string): Promise<any> {
        const headers = {
            "Authorization": `Bearer ${authToken}`,
        }
        try {
            const response = await binaryApi().post(API_ENDPOINTS.STORE_AUTH_TOKEN, {}, { headers });
            if (response.data.message === "success") {
                return "success";
            } else {
                return "failed";
            }
        } catch (error) {
            throw error;
        }
    }

    public async loadAuthToken() {
        try {
            const host= getBinaryHost()
            const response = await binaryApi().get(API_ENDPOINTS.LOAD_AUTH_TOKEN);
            if (response.data.message === "success" && response.data.auth_token) {
                return response.data.auth_token;
            } else {
                return null
            }
        } catch (error) {
            throw error;
        }
    }

    public async deleteAuthToken() {
        try {
            const response = await binaryApi().post(API_ENDPOINTS.DELETE_AUTH_TOKEN);
            if (response.data.message === "success") {
                return response.data.message;
            }
        } catch (error) {
            throw error;
        }
    }
}