import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";

const fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
};

export class ProfileUiService {
    public async getProfileUi(): Promise<any> {
        try {
            const authToken = await fetchAuthToken();
            const headers = {
                "Authorization": `Bearer ${authToken}`
            }
            const response = await api.get(API_ENDPOINTS.PROFILE_UI, {headers});
            refreshCurrentToken(response.headers)
            // console.log("response for profileui",response)
            return response.data.data;
        } catch (error) {
            console.error('Error while fetch profile ui data: ', error);
            throw error; // Throw the error to be handled by the caller
        }
    }
}