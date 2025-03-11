import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";

export class InlineEditService {
    public async generateInlineEdit(payload: any): Promise<any> {
        const headers = {
            'X-Client': 'VSCODE_EXT',
            'X-Client-Version': '0.0.1'
        }
        try {
            const response = await api.post(API_ENDPOINTS.GENERATE_INLINE_EDIT, payload, {headers});
            return response.data.data;
        } catch (error) {
            console.error('Error while generating inline diff: ', error);
            throw error; // Throw the error to be handled by the caller
        }
    }

    public async getInlineDiffResult(job_id: number): Promise<any> {
        try {
            const headers = {
                'X-Client': 'VSCODE_EXT',
                'X-Client-Version': '0.0.1'
            }
            const response = await api.get(API_ENDPOINTS.GET_INLINE_EDIT_RESULT, {headers, params: {job_id: job_id}});
            return response.data.data;
        } catch (error) {
            console.error('Error while fetching inline diff result: ', error);
            throw error; // Throw the error to be handled by the caller
        }
    }
}