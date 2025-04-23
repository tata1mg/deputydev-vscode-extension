import { binaryApi, api } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { ApiErrorHandler } from "../api/apiErrorHandler";
import { AuthService } from "../auth/AuthService";
import { SaveUrlRequest } from "../../types";

export class ReferenceService {
  private apiErrorHandler = new ApiErrorHandler();

  private fetchAuthToken = async () => {
    const authService = new AuthService();
    const authToken = await authService.loadAuthToken();
    return authToken;
  };

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
      response = await binaryApi().post(API_ENDPOINTS.FOCUS_SEARCH, payload);
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async getSavedUrls(): Promise<any> {
    let response;
    try {
      // const authToken = await this.fetchAuthToken();
      // const headers = {
      //   Authorization: `Bearer ${authToken}`,
      // };
      response = await api.get(API_ENDPOINTS.GET_SAVED_URLS, {
        params: {
          limit: 5,
          offset: 0,
        },
        // headers,
      });
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async saveUrl(payload: SaveUrlRequest): Promise<any> {
    let response;
    try {
      // const authToken = await this.fetchAuthToken();
      // const headers = {
      //   Authorization: `Bearer ${authToken}`,
      // };
      await api.post(API_ENDPOINTS.SAVE_URL, payload);
      response = await this.getSavedUrls();
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
