import { binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ErrorTrackingManager } from '../../analyticsTracking/ErrorTrackingManager';
import { sendProgress } from '../../utilities/contextManager';
import { AuthService } from '../auth/AuthService';

export interface UpdateRepoIndexParams {
  repo_path: string;
  retried_by_user?: boolean;
  files_to_update?: string[];
  sync?: boolean;
  enable_embeddings: boolean;
}

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

export interface SyncRepoIndexParams {
  repo_path: string;
  sync: boolean;
  enable_embeddings: boolean;
}

export class IndexingService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();
  private errorTrackingManager = new ErrorTrackingManager();
  public async syncRepoIndex(params: SyncRepoIndexParams): Promise<string[]> {
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await binaryApi().post(API_ENDPOINTS.SYNC_REPO_INDEX, params, {
        headers,
      });
      sendProgress({
        task: 'INDEXING',
        status: 'COMPLETED',
        repo_path: params.repo_path,
        indexed_files: response.data,
      });
      return response.data;
    } catch (error) {
      this.logger.error('error syncing repo index');
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'INDEXING_SERVICE_ERROR',
        errorSource: 'BINARY',
      });
      sendProgress({
        task: 'INDEXING',
        status: 'FAILED',
        repo_path: params.repo_path,
        indexed_files: [],
      });
      this.apiErrorHandler.handleApiError(error);
      throw error;
    }
  }
  public async updateRepoIndex(params: UpdateRepoIndexParams): Promise<any> {
    // console.log(`get focus chunks ${JSON.stringify(payload)}`)
    let response;
    try {
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      response = await binaryApi().post(API_ENDPOINTS.UPDATE_REPO_INDEX, params, {
        headers,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error updating repo index');
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'INDEXING_SERVICE_ERROR',
        errorSource: 'BINARY',
      });
      this.apiErrorHandler.handleApiError(error);
    }
  }
  public async repoSyncStatus(params: { repo_path: string }): Promise<boolean> {
    let response;
    try {
      response = await binaryApi().post(API_ENDPOINTS.REPO_SYNC_STATUS, params);
      console.log('Repo sync status response:', response.data);
      return response.data.completed === true;
    } catch {
      return false;
    }
  }
}
