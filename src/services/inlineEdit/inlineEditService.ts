import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";

export class InlineEditService {
    public async generateInlineEdit(payload: any): Promise<any> {
        try {
            const response = await api.post(API_ENDPOINTS.GENERATE_INLINE_EDIT, payload);
            return response.data.data;
        } catch (error) {
            console.error('Error while generating inline diff: ', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async getInlineDiffResult(job_id: number): Promise<any> {
        try {
            const headers = {
                "job_id": job_id
            }
            const response = await api.get(API_ENDPOINTS.GET_INLINE_EDIT_RESULT, {headers});
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching inline diff result: ', error);
            throw error; // Throw the error to be handled by the caller
        }
    }
}