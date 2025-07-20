import { getActiveRepo } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { api, binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { AuthService } from '../auth/AuthService';
const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

export class ReviewService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();

  // TODO: Need to send the payload
  public async codeReviewPreProcess() {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const payload = {
        user_team_id: 112,
        repo_name: 'merch_service',
        repo_origin: 'github/merch_service',
        diff_s3_url: 'sadhkjhkhdkjs',
        source_branch: 'merch_test1',
        target_branch: 'master',
      };

      const response = await api.post(API_ENDPOINTS.CODE_REVIEW_PRE_PROCESS, payload, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error during code Review Pre Process');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }

  public async newReview(target_branch: string, review_type: string): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await binaryApi().get(API_ENDPOINTS.NEW_REVIEW, {
        params: {
          repo_path: getActiveRepo(),
          target_branch,
          review_type,
        },
        headers,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error creating new review during newReview');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }

  public async searchBranch(keyword: string): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await binaryApi().get(API_ENDPOINTS.SEARCH_BRANCHES, {
        params: {
          repo_path: getActiveRepo(),
          keyword: keyword,
        },
        headers,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching branches during searchBranch');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }

  public async hitSnapshot(reviewType: string): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await binaryApi().post(
        API_ENDPOINTS.SNAPSHOT,
        {},
        {
          params: {
            repo_path: getActiveRepo(),
            review_type: reviewType,
          },
          headers,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching branches during searchBranch');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }

  public async getPastReviews(sourceBranch: string): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await api.get(API_ENDPOINTS.PAST_REVIEWS, {
        params: {
          source_branch: sourceBranch,
          repo_id: 104, // TODO: Make this dynamic
        },
        headers,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching branches during searchBranch');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }

  public async getUserAgents(): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await api.get(API_ENDPOINTS.GET_USER_AGENTS, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching user agents');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }
  // TODO: Proper Integration
  public async updateAgent(agent_id: number, custom_prompt: string, name?: string): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const payload = {
        name: name,
        custom_prompt: custom_prompt,
      };
      const response = await api.patch(`${API_ENDPOINTS.USER_AGENT_CRUD}/${agent_id}`, payload, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching user agents');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }

  public async createAgent(name: string, custom_prompt: string): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const payload = {
        name: name,
        custom_prompt: custom_prompt,
      };
      const response = await api.post(API_ENDPOINTS.USER_AGENT_CRUD, payload, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching user agents');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }

  public async deleteAgent(agent_id: number): Promise<any> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await api.delete(`${API_ENDPOINTS.USER_AGENT_CRUD}/${agent_id}`, { headers });
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching user agents');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }
}
