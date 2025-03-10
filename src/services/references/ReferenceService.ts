import { api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";


export class ReferenceService {
    public async keywordSearch(payload: unknown): Promise<any> {
        let response;
        try {
            response = await api({
                // url: API_ENDPOINTS.KEYWORD_SEARCH, TODO: Change this later
                url: 'http://localhost:9000/v1/keyword_search',
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                data: payload,
            });
            return response.data;
        } catch (error) {
            console.error('Error in getReference API call:', error);
            throw error;
        }
    }
    public async keywordTypeSearch(payload: unknown): Promise<any> {
        let response;
        try {
            response = await api({
                // url: API_ENDPOINTS.KEYWORD_TYPE_SEARCH, TODO: Change this later
                url: 'http://localhost:9000/v1/keyword_type_search',
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                data: payload,
            });
            return response.data;
        } catch (error) {
            console.error('Error in getReference API call:', error);
            throw error;
        }
    }
}
