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
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      response = await binaryApi().get(API_ENDPOINTS.GET_SAVED_URLS, {
        params: {
          limit: 5,
          offset: 0,
        },
        headers,
      });
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async saveUrl(payload: SaveUrlRequest): Promise<any> {
    const authToken = await this.fetchAuthToken();
    const headers = {
      Authorization: `Bearer ${authToken}`,
    };
    try {
      const postResponse = await binaryApi().post(API_ENDPOINTS.SAVE_URL, {
        url: payload,
        headers,
      });

      if (postResponse.status === 200 || postResponse.status === 201) {
        const response = await this.getSavedUrls();
        return response.data;
      } else {
        throw new Error("Failed to save URL");
      }
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async deleteSavedUrl(id: string): Promise<any> {
    try {
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };

      const deleteResponse = await binaryApi().get(
        API_ENDPOINTS.DELETE_SAVED_URL,
        {
          params: { id },
          headers,
        }
      );

      if (deleteResponse.status === 200 || deleteResponse.status === 204) {
        const response = await this.getSavedUrls();
        return response.data;
      } else {
        throw new Error("Failed to delete URL");
      }
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async updateSavedUrl(payload: {
    id: string;
    name: string;
  }): Promise<any> {
    try {
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };

      const updateResponse = await binaryApi().put(
        `${API_ENDPOINTS.SAVE_URL}?id=${payload.id}`,
        { url: payload },
        { headers }
      );

      if (updateResponse.status === 200 || updateResponse.status === 204) {
        const response = await this.getSavedUrls();
        return response.data;
      } else {
        throw new Error("Failed to update URL");
      }
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
  public async urlSearch(payload: { keyword: string }): Promise<any> {
    try {
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };

      const searchResponse = await binaryApi().get(
        `${API_ENDPOINTS.SEARCH_URL}?keyword=${payload.keyword}&limit=5`,
        { headers }
      );
      return searchResponse.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
