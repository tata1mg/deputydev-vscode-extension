import { binaryApi } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";

export class ReferenceService {
  public async keywordSearch(payload: unknown): Promise<any> {
    let response;
    try {
      response = await binaryApi.post(API_ENDPOINTS.KEYWORD_SEARCH, payload);
      return response.data;
    } catch (error) {
      console.error("Error in getReference API call:", error);
      throw error;
    }
  }
  public async keywordTypeSearch(payload: unknown): Promise<any> {
    let response;
    try {
      response = await binaryApi.post(
        API_ENDPOINTS.KEYWORD_TYPE_SEARCH,
        payload
      );
      return response.data;
    } catch (error) {
      console.error("Error in getReference API call:", error);
      throw error;
    }
  }
}
