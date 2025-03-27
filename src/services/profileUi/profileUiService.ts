import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";
import { ApiErrorHandler } from "../api/apiErrorHandler";
import { SESSION_TYPE } from "../../constants";

const fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
};

export class ProfileUiService {
    private apiErrorHandler = new ApiErrorHandler();

    public async getProfileUi(): Promise<any> {
        try {
            const authToken = await fetchAuthToken();
            const headers = {
                "Authorization": `Bearer ${authToken}`
            }
            const response = await api.get(API_ENDPOINTS.PROFILE_UI, {headers, params: {
                session_type: SESSION_TYPE
            }});
            refreshCurrentToken(response.headers)
            // console.log("response for profileui",response)
            return response.data.data;
        } catch (error) {
            this.apiErrorHandler.handleApiError(error);
        }
    }
}