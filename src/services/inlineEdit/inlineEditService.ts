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

export class InlineEditService {
    private logger: ReturnType<typeof SingletonLogger.getInstance>;
    constructor() {
        this.logger = SingletonLogger.getInstance();
    }
    private apiErrorHandler = new ApiErrorHandler();

    public async generateInlineEdit(payload: any, sessionId: number | undefined): Promise<any> {
        try {
            const authToken = await fetchAuthToken();
            const headers = {
                "Authorization": `Bearer ${authToken}`,
                "X-Session-Type": SESSION_TYPE,
                ...(sessionId && { "X-Session-ID": sessionId })
            }
            const response = await api.post(API_ENDPOINTS.GENERATE_INLINE_EDIT, payload, { headers });
            refreshCurrentToken(response.headers)
            return response.data.data;
        } catch (error) {
            this.apiErrorHandler.handleApiError(error);
        }
    }

    public async getInlineDiffResult(job_id: number): Promise<any> {
        try {
            const authToken = await fetchAuthToken();
            const headers = {
                "Authorization": `Bearer ${authToken}`
            }
            const response = await api.get(API_ENDPOINTS.GET_INLINE_EDIT_RESULT, {
                headers,
                params: { job_id }
            });
            refreshCurrentToken(response.headers)
            // console.log(response.data.data)
            return response.data.data;
        } catch (error) {
            this.logger.error("Error fetching inline edit result");
            this.apiErrorHandler.handleApiError(error);
        }
    }
}