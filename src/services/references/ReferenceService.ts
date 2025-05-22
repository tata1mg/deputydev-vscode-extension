import { binaryApi, api } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { AuthService } from '../auth/AuthService';
import { SaveUrlRequest } from '../../types';
import axios from 'axios';
import FormData from 'form-data';
import { getMainConfig } from '../../config/configSetGet';
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

  public async getSavedUrls(isSettings?: boolean): Promise<any> {
    let response;
    try {
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      response = await binaryApi().get(API_ENDPOINTS.GET_SAVED_URLS, {
        params: {
          limit: isSettings ? 20 : 4,
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
        const response = await this.getSavedUrls(payload.isSettings);
        return response;
      } else {
        throw new Error('Failed to save URL');
      }
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async deleteSavedUrl(data: { id: string; isSettings?: boolean }): Promise<any> {
    try {
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };

      const deleteResponse = await binaryApi().get(API_ENDPOINTS.DELETE_SAVED_URL, {
        params: { id: data.id },
        headers,
      });

      if (deleteResponse.status === 200 || deleteResponse.status === 204) {
        const response = await this.getSavedUrls(data.isSettings);
        return response;
      } else {
        throw new Error('Failed to delete URL');
      }
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async updateSavedUrl(payload: { id: string; name: string; isSettings?: boolean }): Promise<any> {
    try {
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };

      const updateResponse = await binaryApi().put(
        `${API_ENDPOINTS.SAVE_URL}?id=${payload.id}`,
        { url: payload },
        { headers },
      );

      if (updateResponse.status === 200 || updateResponse.status === 204) {
        const response = await this.getSavedUrls(payload.isSettings);
        return response;
      } else {
        throw new Error('Failed to update URL');
      }
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
  public async urlSearch(payload: { keyword: string; isSettings?: boolean }): Promise<any> {
    try {
      const authToken = await this.fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };

      const searchResponse = await binaryApi().get(
        `${API_ENDPOINTS.SEARCH_URL}?keyword=${payload.keyword}${payload.isSettings ? '&limit=20' : '&limit=4'}`,
        { headers },
      );
      return searchResponse.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async uploadFileToS3(
    payload: { name: string; type: string; size: number; content: Buffer },
    onProgress?: (percent: number) => void,
  ): Promise<any> {
    try {
      const mainConfig = getMainConfig();
      if (!mainConfig) {
        throw new Error('Main config not found');
      }
      if (!payload.name || !payload.type || !payload.size || !payload.content) {
        throw new Error('Invalid payload: missing required fields');
      }
      if (payload.size > mainConfig['IMAGE_MAX_SIZE']) {
        throw new Error('File size exceeds the maximum allowed limit');
      }
      if (!mainConfig['IMAGE_TYPES'].includes(payload.type)) {
        throw new Error('Invalid file type');
      }
      const authToken = await this.fetchAuthToken();
      const headers = { Authorization: `Bearer ${authToken}` };

      const url_response = await api.post(
        API_ENDPOINTS.GET_PRESIGNED_URL,
        {
          file_name: payload.name,
          file_size: payload.size,
          file_type: payload.type,
        },
        { headers },
      );

      const { post_url, get_url, fields } = url_response.data.data;

      const formData = new FormData();

      // Add all required S3 fields
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
      }

      // IMPORTANT: Append file last, without custom headers
      formData.append('file', payload.content, payload.name);

      // Axios POST to S3
      await axios.post(post_url, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            if (onProgress) onProgress(percent);
          }
        },
      });

      return { get_url, key: fields.key };
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }
}
