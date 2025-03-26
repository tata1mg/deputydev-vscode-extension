import { binaryApi } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { ApiErrorHandler } from "../api/apiErrorHandler";

export class ReferenceService {
  private apiErrorHandler = new ApiErrorHandler();

  public async keywordSearch(payload: unknown): Promise<any> {
    // console.log(`Keyword Search ${JSON.stringify(payload)}`)
    let response;
    try {
      response = await binaryApi().post(API_ENDPOINTS.FOCUS_SEARCH, payload);
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
  public async keywordTypeSearch(payload: unknown): Promise<any> {
    // console.log(`Keyword Type Search ${JSON.stringify(payload)}`)
    let response;
    try {
      response = await binaryApi().post(
        API_ENDPOINTS.FOCUS_SEARCH,
        payload
      );
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
