import { binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ErrorTrackingManager } from '../../analyticsTracking/ErrorTrackingManager';

export class DirectoryStructureService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  private apiErrorHandler = new ApiErrorHandler();
  private errorTrackingManager = new ErrorTrackingManager();

  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  public async getDirectoryStructure(payload: unknown): Promise<any> {
    try {
      const response = await binaryApi().post(API_ENDPOINTS.DIRECTORY_STRUCTURE, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching directory structure');
      this.errorTrackingManager.trackGeneralError(error, 'DIRECTORY_STRUCTURE_ERROR', 'BINARY');
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
