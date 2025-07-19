import * as vscode from 'vscode';
import { CodeReviewWebsocketService, ReviewEvent } from '../services/codeReview/websocket/CodeReviewWebsocket';
import { BackendClient } from '../clients/backendClient';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { SidebarProvider } from '../panels/SidebarProvider';
import { AuthService } from '../services/auth/AuthService';
import { AgentPayload, SearchTerm } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getActiveRepo, getSessionId } from '../utilities/contextManager';
import { resolveDirectoryRelative } from '../utilities/path';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { RelevantCodeSearcherToolService } from '../services/tools/relevantCodeSearcherTool/relevantCodeSearcherToolServivce';
import { ApiErrorHandler } from '../services/api/apiErrorHandler';

export class CodeReviewManager {
  private readonly reviewService: CodeReviewWebsocketService;
  private sidebarProvider?: SidebarProvider; // Optional at first
  private readonly authService = new AuthService();
  private currentAbortController: AbortController | null = null;
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly relevantCodeSearcherToolService: RelevantCodeSearcherToolService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    outputChannel: vscode.LogOutputChannel,
    backendClient: BackendClient,
    relevantCodeSearcherToolService: RelevantCodeSearcherToolService,
    private readonly apiErrorHandler: ApiErrorHandler,
  ) {
    this.outputChannel = outputChannel;
    this.logger = SingletonLogger.getInstance();
    this.reviewService = new CodeReviewWebsocketService(context, outputChannel, backendClient);
    this.relevantCodeSearcherToolService = relevantCodeSearcherToolService;
    this.apiErrorHandler = new ApiErrorHandler();
  }

  // Method to set the sidebar provider later
  setSidebarProvider(sidebarProvider: SidebarProvider) {
    this.sidebarProvider = sidebarProvider;
  }

  public async startCodeReview(agentsPayload: { review_id: number; agents: AgentPayload[] }): Promise<void> {
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      this.outputChannel.info('Starting code review...');

      for await (const event of this.reviewService.startReview(agentsPayload, abortController.signal)) {
        await this.handleReviewEvent(event);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.outputChannel.info('Review was cancelled by user');
        return;
      }
      this.outputChannel.error(`Review error: ${error.message}`, error);
    } finally {
      this.cleanup();
    }
  }

  public async cancelCurrentReview(): Promise<void> {
    if (this.currentAbortController) {
      this.outputChannel.info('Cancelling current review...');
      this.currentAbortController.abort();
      this.cleanup();
    }
  }

  private async handleReviewEvent(event: ReviewEvent): Promise<void> {
    this.outputChannel.debug(`Processing review event: ${event.type}`);
    console.log(`Processing review event: ${event.type}`);

    let currentToolRequest;

    switch (event.type) {
      case 'AGENT_COMPLETE':
        this.sidebarProvider?.sendMessageToSidebar({
          id: uuidv4(),
          command: 'AGENT_COMPLETE',
          data: event,
        });
        break;

      case 'AGENT_FAIL':
        this.sidebarProvider?.sendMessageToSidebar({
          id: uuidv4(),
          command: 'AGENT_FAIL',
          data: event,
        });
        break;

      case 'TOOL_USE_REQUEST':
        console.log('Got tool use request:', event);
        break;
    }
    // 3. Handle Tool Requests
    // if (currentToolRequest) {
    //   await this._runTool();
    // }
  }

  private async _runTool(): Promise<void> {
    class UnknownToolError extends Error {
      constructor(toolName: string) {
        super(`Unknown tool requested: ${toolName}`);
        this.name = 'UnknownToolError';
      }
    }

    // this.outputChannel.info(`Running tool: ${toolRequest.tool_name} (ID: ${toolRequest.tool_use_id})`);
    // if (this.currentAbortController?.signal.aborted) {
    //   this.outputChannel.warn(`_runTool aborted before starting tool: ${toolRequest.tool_name}`);
    //   return;
    // }
    let rawResult: any;
    try {
      const active_repo = getActiveRepo();
      if (!active_repo) {
        throw new Error('Active repository is not defined for running tool.');
      }

      // Execute the specific tool function
      // switch (toolRequest.tool_name) {
      //   case 'related_code_searcher':
      //     rawResult = await this._runRelatedCodeSearcher(parsedContent.repo_path || active_repo, parsedContent);
      //     break;
      //   case 'focused_snippets_searcher':
      //     rawResult = await this._runFocusedSnippetsSearcher(parsedContent.repo_path || active_repo, parsedContent);
      //     break;
      //   case 'file_path_searcher':
      //     this.outputChannel.info(`Running file_path_searcher with params: ${JSON.stringify(parsedContent)}`);
      //     rawResult = await this._runFilePathSearcher(parsedContent.repo_path || active_repo, parsedContent);
      //     break;
      //   case 'iterative_file_reader':
      //     this.outputChannel.info(`Running iterative_file_reader with params: ${JSON.stringify(parsedContent)}`);
      //     rawResult = await this._runIterativeFileReader(
      //       parsedContent.repo_path || active_repo,
      //       parsedContent.file_path,
      //       parsedContent.start_line,
      //       parsedContent.end_line,
      //     );
      //     break;
      //   case 'grep_search':
      //     this.outputChannel.info(`Running grep_search with params: ${JSON.stringify(parsedContent)}`);
      //     rawResult = await this._runGrepSearch(
      //       parsedContent.search_path,
      //       parsedContent.repo_path || active_repo,
      //       parsedContent.query,
      //       parsedContent.case_insensitive,
      //       parsedContent.use_regex,
      //     );
      //     break;
      //   }
      // }

      // if (this.currentAbortController?.signal.aborted) {
      //   this.outputChannel.warn(`_runTool aborted after executing tool: ${toolRequest.tool_name}`);
      //   return;
      // }
      // this.outputChannel.info(`Tool ${toolRequest.tool_name} completed successfully.`);

      // Prepare payload to continue chat with the tool's response
      // const structuredResponse = this._structureToolResponse(toolRequest.tool_name, rawResult);
      const continuationPayload = {};
    } catch (error: any) {
      // handle case where unknown tool is requested
      if (error instanceof UnknownToolError) {
        this.outputChannel.error(`Unknown tool requested: ${error.message}`);
        return;
      }

      // raw error in json
      this.logger.error(`Raw error new: ${JSON.stringify(error)}`);
      let errorResponse = error.response?.data;
      this.logger.error(`Error running tool ${JSON.stringify(errorResponse)}`);
      if (!errorResponse) {
        errorResponse = {
          error_code: 500,
          error_type: 'SERVER_ERROR',
          error_message: error.message,
        };
      }
      if (errorResponse && errorResponse.traceback) {
        delete errorResponse.traceback;
      }
      if (this.currentAbortController?.signal.aborted) {
        // this.outputChannel.warn(`_runTool aborted during execution: ${toolRequest.tool_name}`);
        return;
      }
      // this.logger.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`);
      // this.outputChannel.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`, error);

      const toolUseRetryPayload = {};
      // await this.apiChat(toolUseRetryPayload, chunkCallback);
    }
  }

  private _structureToolResponse(toolName: string, rawResult: any): any {
    switch (toolName) {
      case 'related_code_searcher':
        return { RELEVANT_CHUNKS: rawResult };
      case 'focused_snippets_searcher':
        return { batch_chunks_search: rawResult };
      case 'file_path_searcher':
        return { file_path_search: rawResult };
      case 'execute_command':
        return { execute_command_result: rawResult };
      case 'iterative_file_reader':
        return rawResult; // Already structured
      case 'grep_search':
        return rawResult;
      default:
        // For unknown or simple tools, return the result directly (though handled earlier now)
        return { result: rawResult };
    }
  }

  async _runIterativeFileReader(
    repoPath: string,
    filePath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<any> {
    this.outputChannel.info(`Running iterative file reader for ${filePath}`);
    try {
      const response = await binaryApi().post(API_ENDPOINTS.ITERATIVELY_READ_FILE, {
        repo_path: repoPath,
        file_path: resolveDirectoryRelative(filePath), // Ensures the file path is always relative
        start_line: startLine,
        end_line: endLine,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling Iterative file reader API: ${error.message}`);
      this.outputChannel.error(`Error calling Iterative file reader API: ${error.message}`, error);
      this.apiErrorHandler.handleApiError(error);
    }
  }

  async _runGrepSearch(
    search_path: string,
    repoPath: string,
    query: string,
    case_insensitive?: boolean,
    use_regex?: boolean,
  ): Promise<any> {
    this.outputChannel.info(`Running grep search tool for ${search_path}`);
    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.GREP_SEARCH,
        {
          repo_path: repoPath,
          directory_path: resolveDirectoryRelative(search_path), // Ensures the search path is always absolute
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
      // This will be removed ASAP, its just for now for EMPTY_TOOL_RESPONSE error type.
      try {
        this.apiErrorHandler.handleApiError(error);
      } catch (error: any) {
        const errorData: any = error.response.data;
        if (
          errorData &&
          errorData.error_subtype === 'EMPTY_TOOL_RESPONSE' &&
          errorData.error_type === 'HANDLED_TOOL_ERROR'
        ) {
          return { data: [] };
        } else {
          this.logger.error(`Error calling Grep search API`);
          this.apiErrorHandler.handleApiError(error);
        }
      }
    }
  }

  private async _runRelatedCodeSearcher(
    repo_path: string,
    params: {
      search_query?: string;
      paths?: string[];
    },
  ): Promise<any> {
    const query = params.search_query || '';
    // const focusFiles = params.paths || []; // Currently unused based on original code?
    const currentSessionId = getSessionId();

    if (!currentSessionId) {
      throw new Error('Session ID is required for related_code_searcher');
    }
    this.outputChannel.info(`Executing related_code_searcher: query="${query.substring(0, 50)}..."`);

    try {
      const result = await this.relevantCodeSearcherToolService.runTool({
        repo_path: repo_path,
        query: query,
        focus_files: [], // Explicitly empty based on original logic
        focus_directories: [],
        focus_chunks: [],
        // Uncomment and use focusFiles if needed:
        // focus_files: focusFiles,
        session_id: currentSessionId,
        session_type: '',
      });

      return result.relevant_chunks || []; // Return chunks or empty array
    } catch (error: any) {
      this.logger.error('Failed to run related code searcher: ', error);
      throw error;
    }
  }

  private async _runFocusedSnippetsSearcher(repo_path: string, params: { search_terms?: SearchTerm[] }): Promise<any> {
    const searchTerms = params.search_terms;
    if (!searchTerms || !searchTerms.length) {
      throw new Error("Missing 'search_terms' parameter for focused_snippets_searcher");
    }
    this.outputChannel.info(`Executing focused_snippets_searcher with ${searchTerms.length} terms.`);
    // return this._fetchBatchChunksSearch(repoPath, searchTerms);
    return this._fetchBatchChunksSearch(repo_path, searchTerms);
  }

  private async _fetchBatchChunksSearch(repoPath: string, searchTerms: SearchTerm[]): Promise<any> {
    this.outputChannel.info(`Calling batch chunks search API.`);
    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.BATCH_CHUNKS_SEARCH,
        {
          repo_path: repoPath,
          search_terms: searchTerms,
        },
        { headers },
      );

      this.outputChannel.info('Batch chunks search API call successful.');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling batch chunks search API: ${error}`);
      this.outputChannel.error(`Error calling batch chunks search API: ${error}`, error);
      this.apiErrorHandler.handleApiError(error);
    }
  }

  private async _runFilePathSearcher(
    repo_path: string,
    params: {
      directory?: string;
      search_terms?: string[];
    },
  ): Promise<any> {
    const directory = resolveDirectoryRelative(params.directory);
    const searchTerms = params.search_terms; // Optional
    this.outputChannel.info(
      `Executing file_path_searcher: directory="${directory}", terms="${searchTerms?.join(', ')}"`,
    );
    return this._fetchFilePathSearch(repo_path, directory || '', searchTerms);
  }

  private async _fetchFilePathSearch(repoPath: string, directory: string, searchTerms?: string[]): Promise<any> {
    this.outputChannel.info(`Calling file path search API.`);
    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.FILE_PATH_SEARCH,
        {
          repo_path: repoPath,
          directory: directory,
          search_terms: searchTerms, // Send null/undefined if not provided
        },
        { headers },
      );

      this.outputChannel.info('File path search API call successful.');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling file path search API: ${error.message}`);
      this.outputChannel.error(`Error calling file path search API: ${error.message}`, error);
      this.apiErrorHandler.handleApiError(error);
    }
  }

  private cleanup(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  public dispose(): void {
    this.cleanup();
    this.reviewService.dispose();
  }
}
