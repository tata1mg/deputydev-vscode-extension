import { getActiveRepo } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { binaryApi } from '../api/axios';
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
}
