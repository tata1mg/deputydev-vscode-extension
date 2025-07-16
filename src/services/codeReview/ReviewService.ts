import { getActiveRepo } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { api, binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

export class ReviewService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  // create a construcuter with logger
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();

  public async newReview(target_branch: string, review_type: string): Promise<any> {
    try {
      const response = await binaryApi().get(API_ENDPOINTS.NEW_REVIEW, {
        params: {
          repo_path: getActiveRepo(),
          target_branch,
          review_type,
        },
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
      const response = await binaryApi().get(API_ENDPOINTS.SEARCH_BRANCHES, {
        params: {
          repo_path: getActiveRepo(),
          keyword: keyword,
        },
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
      const response = await binaryApi().post(
        API_ENDPOINTS.SNAPSHOT,
        {}, // No body for this request
        {
          params: {
            repo_path: getActiveRepo(),
            review_type: reviewType,
          },
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
      const response = await api.get(API_ENDPOINTS.PAST_REVIEWS, {
        params: {
          source_branch: 'DD-447', // Assuming source_branch is "DD-447" for the active repo
          repo_id: 104, // Assuming repo_id is 1 for the active repo
        },
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
      const response = await api.get(API_ENDPOINTS.USER_AGENTS, {
        params: {
          user_team_id: 112,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error while fetching user agents');
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }
}
