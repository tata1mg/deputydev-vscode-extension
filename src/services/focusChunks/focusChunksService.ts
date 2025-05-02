import { binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { SingletonLogger } from '../../utilities/Singleton-logger';

export class FocusChunksService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();
  public async getFocusChunks(payload: unknown): Promise<any> {
    // console.log(`get focus chunks ${JSON.stringify(payload)}`)
    let response;
    try {
      response = await binaryApi().post(API_ENDPOINTS.FOCUS_CHUNKS, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching focus chunks');
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
