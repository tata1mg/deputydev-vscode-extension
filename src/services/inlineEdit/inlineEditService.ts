import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { AuthService } from "../auth/AuthService";

const fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
};

export class InlineEditService {
    public async generateInlineEdit(payload: any): Promise<any> {
        try {
            const authToken = await fetchAuthToken();
            const headers = {
                "Authorization": `Bearer ${authToken}`
            }
            const response = await api.post(API_ENDPOINTS.GENERATE_INLINE_EDIT, payload, { headers });
            return response.data.data;
        } catch (error) {
            console.error('Error while generating inline diff: ', error);
            throw error; // Throw the error to be handled by the caller
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
            console.log(response.data.data)
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching inline diff result: ', error);
            throw error; // Throw the error to be handled by the caller
        }
    }
}