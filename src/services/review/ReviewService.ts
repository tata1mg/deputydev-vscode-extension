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

  public async newReview(repo_path: string, target_branch: string, review_type: string): Promise<any> {
    try {
      const response = await binaryApi().get(API_ENDPOINTS.NEW_REVIEW, {
        params: {
          repo_path,
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
}
