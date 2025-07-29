import * as vscode from 'vscode';
import { CodeReviewWebsocketService } from '../services/codeReview/websocket/CodeReviewWebsocket';
import { BackendClient } from '../clients/backendClient';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { SidebarProvider } from '../panels/SidebarProvider';
import { AuthService } from '../services/auth/AuthService';
import {
  AgentPayload,
  ReviewEvent,
  ReviewToolUseRequest,
  FilePathSearchInput,
  IterativeFileReaderInput,
  GrepSearchInput,
  SearchTerm,
  PostProcessEvent,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getActiveRepo, getReviewId } from '../utilities/contextManager';
import { resolveDirectoryRelative } from '../utilities/path';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { ApiErrorHandler } from '../services/api/apiErrorHandler';
import { ReferenceService } from '../services/references/ReferenceService';

export class CodeReviewManager {
  private readonly reviewService: CodeReviewWebsocketService;
  private sidebarProvider?: SidebarProvider; // Optional at first
  private readonly authService = new AuthService();
  private currentAbortController: AbortController | null = null;
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly referenceService: ReferenceService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    outputChannel: vscode.LogOutputChannel,
    backendClient: BackendClient,
    private readonly apiErrorHandler: ApiErrorHandler,
  ) {
    this.outputChannel = outputChannel;
    this.logger = SingletonLogger.getInstance();
    this.reviewService = new CodeReviewWebsocketService(context, outputChannel, backendClient);
    this.referenceService = new ReferenceService();
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

  private async handleReviewEvent(event: ReviewEvent): Promise<void> {
    this.outputChannel.info(`Processing review event: ${event}`);
    let currentToolRequest: ReviewToolUseRequest | undefined;

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
        this.logger.error('Agent Failed while code review:', event);
        break;

      case 'TOOL_USE_REQUEST':
        if (event.data) {
          currentToolRequest = {
            agent_id: event.agent_id,
            tool_use_id: event.data.tool_use_id,
            tool_name: event.data.tool_name,
            tool_input: event.data.tool_input,
          };
        }
        break;
    }
    // 3. Handle Tool Requests
    if (currentToolRequest) {
      await this._runTool(currentToolRequest);
    }
  }

  private async _runTool(toolRequest: ReviewToolUseRequest): Promise<void> {
    class UnknownToolError extends Error {
      constructor(toolName: string) {
        super(`Unknown tool requested: ${toolName}`);
        this.name = 'UnknownToolError';
      }
    }

    const reviewId = getReviewId();
    if (!reviewId) {
      this.outputChannel.error('Review ID is not defined for running tool.');
      return;
    }

    this.outputChannel.info(`Running tool: ${toolRequest.tool_name} (ID: ${toolRequest.tool_use_id})`);

    if (this.currentAbortController?.signal.aborted) {
      this.outputChannel.warn(`_runTool aborted before starting tool: ${toolRequest.tool_name}`);
      return;
    }
    const agent_id = toolRequest.agent_id;
    let rawResult: any;
    try {
      const active_repo = getActiveRepo();
      if (!active_repo) {
        throw new Error('Active repository is not defined for running tool.');
      }

      // Execute the specific tool function
      switch (toolRequest.tool_name) {
        case 'file_path_searcher': {
          this.outputChannel.info(`Running file_path_searcher with params: ${JSON.stringify(toolRequest.tool_input)}`);
          const input = toolRequest.tool_input as FilePathSearchInput;
          rawResult = await this._runFilePathSearcher(active_repo, input.directory, input.search_terms);
          break;
        }

        case 'iterative_file_reader': {
          this.outputChannel.info(
            `Running iterative_file_reader with params: ${JSON.stringify(toolRequest.tool_input)}`,
          );
          const input = toolRequest.tool_input as IterativeFileReaderInput;
          rawResult = await this._runIterativeFileReader(
            active_repo,
            input.file_path,
            input.start_line,
            input.end_line,
          );
          break;
        }

        case 'grep_search': {
          this.outputChannel.info(`Running grep_search with params: ${JSON.stringify(toolRequest.tool_input)}`);
          const input = toolRequest.tool_input as GrepSearchInput;
          const response = await this._runGrepSearch(
            input.search_path,
            active_repo,
            input.query,
            input.case_insensitive,
            input.use_regex,
          );
          rawResult = response.data;
          break;
        }

        default:
          throw new UnknownToolError(toolRequest.tool_name);
      }

      if (this.currentAbortController?.signal.aborted) {
        this.outputChannel.warn(`_runTool aborted after executing tool: ${toolRequest.tool_name}`);
        return;
      }

      this.outputChannel.info(`Tool ${toolRequest.tool_name} completed successfully.`);
      const structuredResponse = this._structureToolResponse(toolRequest.tool_name, rawResult);

      const agentsToolUseResponses: any[] = [];

      const toolUseResponsePayload = {
        agent_id: agent_id,
        review_id: reviewId,
        type: 'tool_use_response',
        tool_use_response: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          response: structuredResponse,
        },
      };

      agentsToolUseResponses.push(toolUseResponsePayload);

      const continuationPayload = {
        review_id: reviewId,
        agents: agentsToolUseResponses,
      };

      await this.startCodeReview(continuationPayload);
    } catch (error: any) {
      const reviewId = getReviewId();
      if (!reviewId) {
        this.outputChannel.error('Review ID is not defined for running tool.');
        return;
      }

      if (error instanceof UnknownToolError) {
        this.outputChannel.error(`Unknown tool requested: ${error.message}`);
        return;
      }

      this.logger.error(`Error in _runTool  while code review: ${error.message}`, error);
      const errorResponse = error.response?.data || {
        error_code: 500,
        error_type: 'SERVER_ERROR',
        error_message: error.message,
      };

      if (errorResponse.traceback) {
        delete errorResponse.traceback;
      }

      if (!this.currentAbortController?.signal.aborted) {
        this.outputChannel.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`, error);
        const agentsToolUseResponses: any[] = [];
        const toolUseRetryPayload = {
          agent_id: agent_id,
          review_id: reviewId,
          type: 'tool_use_failed',
          tool_use_response: {
            tool_name: toolRequest.tool_name,
            tool_use_id: toolRequest.tool_use_id,
            response: errorResponse,
          },
        };
        agentsToolUseResponses.push(toolUseRetryPayload);
        const continuationPayload = {
          review_id: reviewId,
          agents: agentsToolUseResponses,
        };

        await this.startCodeReview(continuationPayload);
      }
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
      const file_path = await resolveDirectoryRelative(filePath);
      const response = await binaryApi().post(API_ENDPOINTS.ITERATIVELY_READ_FILE, {
        repo_path: repoPath,
        file_path: file_path, // Ensures the file path is always relative
        start_line: startLine,
        end_line: endLine,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling Iterative file reader API while code review: ${error.message}`);
      this.outputChannel.error(`Error calling Iterative file reader API: ${error.message}`, error);
      this.apiErrorHandler.handleApiError(error);
    }
  }

  private async _runFilePathSearcher(repoPath: string, directory: string, searchTerms?: string[]): Promise<any> {
    this.outputChannel.info(`Calling file path search API.`);
    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };

    const resolvedDirectory = await resolveDirectoryRelative(directory);
    this.outputChannel.info(
      `Executing file_path_searcher: directory="${directory}", terms="${searchTerms?.join(', ')}"`,
    );

    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.FILE_PATH_SEARCH,
        {
          repo_path: repoPath,
          directory: resolvedDirectory,
          search_terms: searchTerms, // Send null/undefined if not provided
        },
        { headers },
      );

      this.outputChannel.info('File path search API call successful.');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling file path search API while code review: ${error.message}`);
      this.outputChannel.error(`Error calling file path search API: ${error.message}`, error);
      this.apiErrorHandler.handleApiError(error);
    }
  }

  private async _runGrepSearch(
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
      const searchPath = await resolveDirectoryRelative(search_path);
      const response = await binaryApi().post(
        API_ENDPOINTS.GREP_SEARCH,
        {
          repo_path: repoPath,
          directory_path: searchPath,
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
          this.logger.error(`Error calling Grep search API while code review`);
          this.apiErrorHandler.handleApiError(error);
        }
      }
    }
  }

  private _structureToolResponse(toolName: string, rawResult: any): any {
    switch (toolName) {
      case 'file_path_searcher':
        return { file_path_search: rawResult };
      case 'iterative_file_reader':
        return rawResult;
      case 'grep_search':
        return rawResult;
      default:
        return { result: rawResult };
    }
  }

  public async startCodeReviewPostProcess(payload: { review_id: number }): Promise<void> {
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      this.outputChannel.info('Starting code review post process...');

      for await (const event of this.reviewService.startPostProcess(payload, abortController.signal)) {
        await this.handleReviewPostProcessEvents(event);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.outputChannel.info('Review post process was cancelled by user');
        return;
      }
      this.outputChannel.error(`Review post process error: ${error.message}`, error);
    } finally {
      this.cleanup();
    }
  }

  private async handleReviewPostProcessEvents(event: PostProcessEvent) {
    this.outputChannel.info(`Processing review post process event: ${event}`);
    switch (event.type) {
      case 'POST_PROCESS_START':
        this.sidebarProvider?.sendMessageToSidebar({
          id: uuidv4(),
          command: 'POST_PROCESS_START',
          data: event,
        });
        break;
      case 'POST_PROCESS_COMPLETE':
        this.sidebarProvider?.sendMessageToSidebar({
          id: uuidv4(),
          command: 'POST_PROCESS_COMPLETE',
          data: event,
        });
        break;
      case 'POST_PROCESS_ERROR':
        this.sidebarProvider?.sendMessageToSidebar({
          id: uuidv4(),
          command: 'POST_PROCESS_ERROR',
          data: event,
        });
        break;
    }
  }

  public async cancelReview(): Promise<void> {
    try {
      this.outputChannel.info('Cancelling review and cleaning up...');

      // Cancel any ongoing review or post-process
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }

      // Close WebSocket connections
      this.reviewService.dispose();

      // Notify the UI that the review was cancelled
      this.sidebarProvider?.sendMessageToSidebar({
        id: uuidv4(),
        command: 'REVIEW_CANCELLED',
        data: { message: 'Review was cancelled by user' },
      });

      this.outputChannel.info('Review cancelled successfully');
    } catch (error: any) {
      this.outputChannel.error(`Error while cancelling review: ${error.message}`, error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  public async uploadDiffToS3(diff: unknown): Promise<{ get_url: string; key: string }> {
    try {
      // ── 1. Serialise / buffer ─────────────────────────────────────
      const serialised = typeof diff === 'string' ? diff : JSON.stringify(diff, null, 0);
      const buffer = Buffer.from(serialised, 'utf8');

      // ── 2. Build file-upload descriptor ───────────────────────────
      const fileDescriptor = {
        name: uuidv4() + '.json',
        type: 'application/json',
        size: buffer.length,
        content: buffer,
        folder: 'review_diff' as const,
      };

      // ── 3. Upload via the underlying ReferenceService ────────────
      const response = await this.referenceService.uploadFileToS3(fileDescriptor);

      this.outputChannel.info('uploadDiffToS3-response', response);
      return response; // { get_url, key }
    } catch (err) {
      this.outputChannel.error('uploadDiffToS3-error', err);
      throw err;
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
