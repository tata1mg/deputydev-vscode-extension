import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";
import { refreshCurrentToken } from "../refreshToken/refreshCurrentToken";
import { ApiErrorHandler } from "../api/apiErrorHandler";
import { SESSION_TYPE } from "../../constants";
import { SingletonLogger } from "../../utilities/Singleton-logger";

const fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
};

export class ProfileUiService {
    private logger: ReturnType<typeof SingletonLogger.getInstance>;
    constructor() {
        this.logger = SingletonLogger.getInstance();
    }
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
            this.logger.error("Error fetching user profile data");
            this.apiErrorHandler.handleApiError(error);
        }
    }
}