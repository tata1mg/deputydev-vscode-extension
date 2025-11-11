import { binaryApi } from '../../api/axios';
import { API_ENDPOINTS } from '../../api/endpoints';
import { SingletonLogger } from '../../../utilities/Singleton-logger';
import { AuthService } from '../../auth/AuthService';
import * as vscode from 'vscode';
import { ErrorTrackingManager } from '../../../analyticsTracking/ErrorTrackingManager';
import { ApiErrorHandler } from '../../api/apiErrorHandler';

interface SemanticSearchParams {
  repo_path: string;
  query: string;
  explanation: string;
  session_id: number;
  session_type: string;
  focus_directories?: string[];
  perform_chunking?: boolean;
}

export class SemanticSearchToolService {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly authService: AuthService;
  private readonly errorTrackingManager: ErrorTrackingManager;
  private readonly apiErrorHandler: ApiErrorHandler;
  constructor(outputChannel: vscode.LogOutputChannel, authService: AuthService) {
    this.logger = SingletonLogger.getInstance();
    this.outputChannel = outputChannel;
    this.authService = authService;
    this.errorTrackingManager = new ErrorTrackingManager();
    this.apiErrorHandler = new ApiErrorHandler();
  }

  public async runTool(params: SemanticSearchParams): Promise<any> {
    this.outputChannel.info('Running Semantic Search Tool with params: ' + JSON.stringify(params));

    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };

    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.SEMANTIC_SEARCH,
        {
          repo_path: params.repo_path,
          query: params.query,
          explanation: params.explanation,
          focus_directories: params.focus_directories,
          session_id: params.session_id,
          session_type: params.session_type,
        },
        { headers },
      );

      this.outputChannel.info('Semantic search API call successful.');
      this.outputChannel.info(`Semantic search result: ${JSON.stringify(response.data)}`);

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to run semantic search tool: ', error);
      this.outputChannel.error('Error during Semantic Search Tool execution: ' + error.message);
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'SEMANTIC_SEARCH_TOOL_ERROR',
        errorSource: 'BINARY',
        sessionId: params.session_id,
        repoPath: params.repo_path,
      });
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
