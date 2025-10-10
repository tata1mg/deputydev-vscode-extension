import { binaryApi } from '../../services/api/axios';
import { API_ENDPOINTS } from '../../services/api/endpoints';

import { resolveDirectoryRelative } from '../../utilities/path';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { AuthService } from '../../services/auth/AuthService';
import * as vscode from 'vscode';

/**
 * Arguments for GrepSearchTool
 */
export interface GrepSearchArgs {
  search_path: string;
  repoPath: string;
  query: string;
  case_insensitive?: boolean;
  use_regex?: boolean;
}

/**
 * Handles server-side grep search requests through the Binary API.
 * Encapsulates authentication, error handling, and consistent logging.
 */
export class GrepSearchTool {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly authService: AuthService;

  constructor(outputChannel: vscode.LogOutputChannel, authService: AuthService) {
    this.logger = SingletonLogger.getInstance();
    this.outputChannel = outputChannel;
    this.authService = authService;
  }

  /**
   * Executes a grep search request via the Binary API.
   * Returns structured search results or a fallback empty result on known handled errors.
   */
  public async runGrepSearch(args: GrepSearchArgs): Promise<any> {
    const { search_path, repoPath, query, case_insensitive, use_regex } = args;
    this.outputChannel.info(`Running grep search tool for ${search_path}`);

    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };

    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.GREP_SEARCH,
        {
          repo_path: repoPath,
          directory_path: await resolveDirectoryRelative(search_path), // Always relative
          search_term: query,
          case_insensitive: case_insensitive || false,
          use_regex: use_regex || false,
        },
        { headers },
      );

      this.outputChannel.info('Grep search API call successful.');
      this.outputChannel.info(`Grep search result: ${JSON.stringify(response.data)}`);

      return response.data;
    } catch (error: any) {
      // Try handling gracefully with known error subtype
      try {
        this.handleApiError(error);
      } catch (innerError: any) {
        const errorData = innerError?.response?.data;

        if (
          errorData &&
          errorData.error_subtype === 'EMPTY_TOOL_RESPONSE' &&
          errorData.error_type === 'HANDLED_TOOL_ERROR'
        ) {
          this.logger.warn('GrepSearchTool received EMPTY_TOOL_RESPONSE.');
          return {
            data: [],
            search_term: query,
            directory_path: search_path,
            case_insensitive: case_insensitive,
            use_regex: use_regex,
          };
        } else {
          this.logger.error(`Error calling Grep search API: ${JSON.stringify(errorData)}`);
          throw innerError;
        }
      }
    }
  }

  /**
   * Centralized error handling helper for API calls.
   */
  private handleApiError(error: any): void {
    const message = error?.response?.data?.error_message || error.message || 'Unknown error';
    this.logger.error(`GrepSearchTool error: ${message}`);
    throw error;
  }
}
