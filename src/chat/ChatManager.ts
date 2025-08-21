import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RelevantCodeSearcherToolService } from '../services/tools/relevantCodeSearcherTool/relevantCodeSearcherToolServivce';
import { getEnvironmentDetails } from '../code_syncing/EnvironmentDetails';
import { v4 as uuidv4 } from 'uuid';

import { SESSION_TYPE } from '../constants';
import { DiffManager } from '../diff/diffManager';
import { MCPManager } from '../mcp/mcpManager';
import { SidebarProvider } from '../panels/SidebarProvider';
import { ApiErrorHandler } from '../services/api/apiErrorHandler';
import { api, binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { AuthService } from '../services/auth/AuthService';
import { QuerySolverService, ThrottlingException, TokenLimitException } from '../services/chat/ChatService';
import { FocusChunksService } from '../services/focusChunks/focusChunksService';
import { getShell } from '../terminal/utils/shell';
import { ChatPayload, Chunk, ChunkCallback, ClientTool, SearchTerm, ThrottlingErrorData, ToolRequest } from '../types';
import { UsageTrackingManager } from '../analyticsTracking/UsageTrackingManager';
import { ErrorTrackingManager } from '../analyticsTracking/ErrorTrackingManager';
import {
  getActiveRepo,
  getIsEmbeddingDoneForActiveRepo,
  getSessionId,
  setSessionId,
} from '../utilities/contextManager';
import { getOSName } from '../utilities/osName';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { cancelChat, registerApiChatTask, unregisterApiChatTask } from './ChatCancellationManager';
import { ReplaceInFile } from './tools/ReplaceInFileTool';
import { GetUsagesTool } from './tools/usages/GetUsageTool';
import { GetResolveModuleTool } from './tools/usages/ResolveModule';

import { TerminalExecutor } from './tools/TerminalTool';
import { WriteToFileTool } from './tools/WriteToFileTool';
import { truncatePayloadValues } from '../utilities/errorTrackingHelper';
import { BackendClient } from '../clients/backendClient';
import { refreshCurrentToken } from '../services/refreshToken/refreshCurrentToken';
import { resolveDirectoryRelative } from '../utilities/path';
import { DirectoryStructureService } from '../services/focusChunks/directoryStructureService';
import { getIsLspReady } from '../languageServer/lspStatus';
import { LanguageFeaturesService } from '../languageServer/languageFeaturesService';

interface ToolUseApprovalStatus {
  approved: boolean;
  autoAcceptNextTime: boolean;
}
export class ChatManager {
  private readonly querySolverService = new QuerySolverService(this.context, this.outputChannel, this.backendClient);
  private sidebarProvider?: SidebarProvider; // Optional at first
  private readonly focusChunksService = new FocusChunksService();
  private readonly directoryStructureService = new DirectoryStructureService();
  private readonly authService = new AuthService();
  private readonly languageFeaturesService = new LanguageFeaturesService();
  private readonly getUsagesTool = new GetUsagesTool(this.languageFeaturesService);
  private readonly getResolveModuleTool = new GetResolveModuleTool(this.languageFeaturesService);

  private currentAbortController: AbortController | null = null;
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  public _onTerminalApprove = new vscode.EventEmitter<{ toolUseId: string; command: string }>();
  public _onToolUseApprove = new vscode.EventEmitter<{
    toolUseId: string;
    autoAcceptNextTime: boolean;
    approved: boolean;
  }>();
  public onTerminalApprove = this._onTerminalApprove.event;
  public onToolUseApprovalEvent = this._onToolUseApprove.event;
  private readonly terminalExecutor: TerminalExecutor;
  private replaceInFileTool!: ReplaceInFile;
  private writeToFileTool!: WriteToFileTool;
  private readonly relevantCodeSearcherToolService: RelevantCodeSearcherToolService;
  // private mcpManager: MCPManager;

  onStarted: () => void = () => {};
  onError: (error: Error) => void = () => {};
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly diffManager: DiffManager,
    private readonly apiErrorHandler: ApiErrorHandler,
    private readonly mcpManager: MCPManager,
    private readonly usageTrackingManager: UsageTrackingManager,
    private readonly errorTrackingManager: ErrorTrackingManager,
    private readonly backendClient: BackendClient,
    relevantCodeSearcherToolService: RelevantCodeSearcherToolService,
  ) {
    this.apiErrorHandler = new ApiErrorHandler();
    this.logger = SingletonLogger.getInstance();
    this.terminalExecutor = new TerminalExecutor(this.context, this.logger, this.onTerminalApprove, this.outputChannel);
    this.relevantCodeSearcherToolService = relevantCodeSearcherToolService;
  }

  // Method to set the sidebar provider later
  setSidebarProvider(sidebarProvider: SidebarProvider) {
    this.sidebarProvider = sidebarProvider;
    // Initialize ReplaceInFile after sidebarProvider is set
    this.replaceInFileTool = new ReplaceInFile(
      this.context,
      this.logger,
      this.outputChannel,
      this.sidebarProvider,
      this.authService,
      this.diffManager,
    );
    this.writeToFileTool = new WriteToFileTool(
      this.context,
      this.logger,
      this.outputChannel,
      this.sidebarProvider,
      this.authService,
      this.diffManager,
    );
  }
  async start() {
    // this.outputChannel.info("Starting deputydev binary service...");
  }

  restart() {
    // this.outputChannel.info("Restarting deputydev binary service...");
    this.stop();
    this.start();
  }

  stop() {
    this.logger.info('Stopping deputydev binary service...');
    this.outputChannel.info('Stopping deputydev binary service...');
  }

  async getFocusChunks(data: ChatPayload): Promise<any[]> {
    const active_repo = getActiveRepo();
    if (!active_repo) {
      throw new Error('Active repository is not defined.');
    }

    const focusItemsResult: Array<any> = [];
    this.outputChannel.info(`Focus items: ${JSON.stringify(data.focusItems)}`);

    try {
      await Promise.all(
        (data.focusItems ?? []).map(async (item) => {
          // Always fetch directory structure if it's a directory
          if (item.type === 'directory') {
            const directoryPayload = {
              auth_token: await this.authService.loadAuthToken?.(),
              repo_path: active_repo,
              directory_path: item.path,
            };

            const structure = await this.directoryStructureService.getDirectoryStructure(directoryPayload);

            focusItemsResult.push({
              type: item.type,
              value: item.value,
              path: item.path,
              structure: structure,
            });
          } else if (item.type === 'url') {
            focusItemsResult.push({
              type: item.type,
              value: item.value,
              chunks: item.chunks,
              url: item.url,
            });
            // Process chunks if present (even for directories)
          } else if (item.chunks && item.chunks.length > 0) {
            const chunkDetails: Array<Chunk> = item.chunks;

            const result = await this.focusChunksService.getFocusChunks({
              auth_token: await this.authService.loadAuthToken(),
              repo_path: active_repo,
              chunks: chunkDetails,
              search_item_name: item.value,
              search_item_type: item.type,
              search_item_path: item.path,
            });

            const finalChunkInfos: Array<any> = result.map((chunkInfoWithHash: any) => chunkInfoWithHash.chunk_info);

            focusItemsResult.push({
              type: item.type,
              value: item.value,
              chunks: finalChunkInfos || [],
              path: item.path,
            });
          }
        }),
      );

      return focusItemsResult;
    } catch (error) {
      this.outputChannel.error(`Error fetching focus items or directory structure: ${error}`);
      return [];
    }
  }

  /**
   * Fetches relevant previous chat messages from the current session based on the new query.
   * @param currentSessionId The ID of the current chat session.
   * @param query The current user query.
   * @returns An object containing the concatenated text of relevant history and their IDs.
   */

  private async getDeputyDevRulesContent(): Promise<string | null> {
    const active_repo = getActiveRepo();
    if (!active_repo) {
      this.outputChannel.error('Active repository is not defined.');
      return null;
    }

    const filePath = path.join(active_repo, '.deputydevrules');

    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (error) {
      this.logger.error('Error reading .deputydevrules file');
      this.outputChannel.error('Error reading .deputydevrules file');
    }
    return null;
  }

  private async getExtraTools(): Promise<Array<ClientTool>> {
    // get all MCP tools. There can be scope to add non MCP tools later on, i.e. custom tools on client basis

    const currentMCPTools = await this.mcpManager.getCurrentMCPTools();

    const clientTools: Array<ClientTool> = [];

    // create a mapping mcpToolUniqueIds and mcpMetadata
    // the unique ID is the combination of serverId and tool name
    for (const server of currentMCPTools) {
      for (const tool of server.tools) {
        const mcpToolUniqueId = `${server.serverId}-${tool.name}`;
        clientTools.push({
          name: mcpToolUniqueId,
          description: tool.description ?? '',
          input_schema: tool.inputSchema,
          tool_metadata: {
            type: 'MCP',
            tool_name: tool.name,
            server_id: server.serverId,
          },
          auto_approve: tool.auto_approve,
        });
      }
    }

    this.outputChannel.info(`Client tools: ${JSON.stringify(clientTools)}`);
    return clientTools;
  }

  /**
   * apiChat:
   * Expects a payload that includes message_id along with the query with other parameters,
   * and uses the querySolver service to yield text chunks. Each chunk is sent via
   * the provided chunkCallback.
   */

  async apiChat(payload: ChatPayload, chunkCallback: ChunkCallback) {
    const originalPayload = structuredClone(payload);
    const abortController = new AbortController();
    this.currentAbortController = abortController; // Track the current controller
    let querySolverTask:
      | {
          abortController: AbortController;
          asyncIterator: AsyncIterableIterator<any>;
        }
      | undefined;

    try {
      this.outputChannel.info('apiChat initiated.');
      this.outputChannel.info(`Initial payload: ${JSON.stringify(payload)}`);

      const messageId = payload.message_id; // Store for later use, e.g., in tool responses
      this.outputChannel.info(`Message ID: ${messageId}`);

      // 1. Prepare Context: History and Focus Items
      if (payload.focusItems && payload.focusItems.length > 0) {
        payload.focus_items = await this.getFocusChunks(payload);
      }

      delete payload.focusItems;

      delete payload.message_id; // Backend doesn't need this directly

      if (payload.is_tool_response) {
        delete payload.query;
      }
      delete payload.is_tool_response;

      const deputyDevRules = await this.getDeputyDevRulesContent();
      if (deputyDevRules) {
        payload.deputy_dev_rules = deputyDevRules;
      }
      payload.os_name = await getOSName();
      payload.shell = getShell();
      payload.vscode_env = await getEnvironmentDetails(true, payload);
      const clientTools = await this.getExtraTools();
      payload.client_tools = clientTools;
      payload.is_embedding_done = getIsEmbeddingDoneForActiveRepo();
      payload.is_lsp_ready = await getIsLspReady({ force: true });

      this.outputChannel.info('Payload prepared for QuerySolverService.');
      this.outputChannel.info(`Processed payload: ${JSON.stringify(payload)}`);

      // 2. Call Query Solver Service and Register Task for Cancellation
      const querySolverIterator = this.querySolverService.querySolver(payload, abortController.signal);
      querySolverTask = { abortController, asyncIterator: querySolverIterator };
      registerApiChatTask(querySolverTask);

      this.outputChannel.info('QuerySolverService called, listening for events...');

      let currentToolRequest: ToolRequest | null = null;
      let currentDiffRequest: { filepath: string; raw_diff?: string } | null = null;
      const pendingToolRequests: ToolRequest[] = [];

      for await (const event of querySolverIterator) {
        if (abortController.signal.aborted) {
          this.outputChannel.warn('apiChat aborted by cancellation signal.');
          break; // Exit loop if cancelled
        }
        switch (event.type) {
          case 'RESPONSE_METADATA': {
            const sessionId = event.content?.session_id;
            if (sessionId) {
              // Set session ID if not already set
              setSessionId(sessionId);
              this.outputChannel.info(`Session ID set: ${sessionId}`);
            }
            chunkCallback({ name: event.type, data: event.content });
            break;
          }
          case 'TOOL_USE_REQUEST_START': {
            currentToolRequest = {
              tool_name: event.content.tool_name,
              tool_use_id: event.content.tool_use_id,
              accumulatedContent: '',
              write_mode: payload.write_mode || false,
              is_inline: payload.is_inline || false,
              llm_model: payload.llm_model,
              search_web: payload.search_web,
            };
            // Immediately forward the start event.
            const detectedClientTool = clientTools.find((x) => x.name === currentToolRequest?.tool_name);
            if (detectedClientTool) {
              chunkCallback({
                name: 'TOOL_CHIP_UPSERT',
                data: {
                  toolRequest: {
                    requestData: null,
                    toolName: event.content.tool_name,
                    toolMeta: {
                      toolName: detectedClientTool.tool_metadata.tool_name,
                      serverName: detectedClientTool.tool_metadata.server_id,
                    },
                    requiresApproval: !detectedClientTool.auto_approve,
                  },
                  toolResponse: null,
                  toolRunStatus: 'pending',
                  toolUseId: event.content.tool_use_id,
                },
              });
            } else {
              chunkCallback({
                name: 'TOOL_CHIP_UPSERT',
                data: {
                  toolRequest: {
                    toolName: event.content.tool_name,
                  },
                  toolRunStatus: 'pending',
                  toolUseId: event.content.tool_use_id,
                },
              });
            }
            break;
          }
          case 'TOOL_USE_REQUEST_DELTA': {
            if (currentToolRequest) {
              currentToolRequest.accumulatedContent += event.content?.input_params_json_delta || '';
              // Forward the delta along with the tool_use_id.
              const detectedClientTool = clientTools.find((x) => x.name === currentToolRequest?.tool_name);
              if (detectedClientTool) {
                chunkCallback({
                  name: 'TOOL_CHIP_UPSERT',
                  data: {
                    toolRequest: {
                      requestData: currentToolRequest.accumulatedContent,
                      toolName: currentToolRequest.tool_name,
                      toolMeta: {
                        toolName: detectedClientTool.tool_metadata.tool_name,
                        serverName: detectedClientTool.tool_metadata.server_id,
                      },
                      requiresApproval: !detectedClientTool.auto_approve,
                    },
                    toolResponse: null,
                    toolRunStatus: 'pending',
                    toolUseId: currentToolRequest.tool_use_id,
                  },
                });
              } else {
                chunkCallback({
                  name: 'TOOL_CHIP_UPSERT',
                  data: {
                    toolRequest: {
                      requestData: currentToolRequest.accumulatedContent,
                      toolName: currentToolRequest.tool_name,
                    },
                    toolRunStatus: 'pending',
                    toolUseId: currentToolRequest.tool_use_id,
                  },
                });
              }
            }
            break;
          }
          case 'TOOL_USE_REQUEST_END': {
            if (currentToolRequest) {
              pendingToolRequests.push({ ...currentToolRequest });
              const detectedClientTool = clientTools.find((x) => x.name === currentToolRequest?.tool_name);
              if (detectedClientTool) {
                chunkCallback({
                  name: 'TOOL_CHIP_UPSERT',
                  data: {
                    toolRequest: {
                      requestData: currentToolRequest.accumulatedContent,
                      toolName: currentToolRequest.tool_name,
                      toolMeta: {
                        toolName: detectedClientTool.tool_metadata.tool_name,
                        serverName: detectedClientTool.tool_metadata.server_id,
                      },
                      requiresApproval: !detectedClientTool.auto_approve,
                    },
                    toolResponse: null,
                    toolRunStatus: 'pending',
                    toolUseId: currentToolRequest.tool_use_id,
                  },
                });
              } else {
                chunkCallback({
                  name: 'TOOL_CHIP_UPSERT',
                  data: {
                    toolRequest: {
                      requestData: currentToolRequest.accumulatedContent,
                      toolName: currentToolRequest.tool_name,
                    },
                    toolResponse: null,
                    toolRunStatus: 'pending',
                    toolUseId: currentToolRequest.tool_use_id,
                  },
                });
              }
            }
            currentToolRequest = null;
            break;
          }
          case 'CODE_BLOCK_START':
            if (event.content?.is_diff && !payload.write_mode) {
              currentDiffRequest = {
                filepath: event.content?.filepath,
                // raw_diff will be populated at CODE_BLOCK_END
              };
              this.outputChannel.info(`Starting diff block for: ${currentDiffRequest.filepath}`);
            }
            chunkCallback({ name: event.type, data: event.content });
            break;

          case 'CODE_BLOCK_END': {
            this.outputChannel.info(`Code block end: ${JSON.stringify(event.content)}`);
            if (currentDiffRequest) {
              currentDiffRequest.raw_diff = event.content.diff;
              chunkCallback({ name: event.type, data: event.content });

              const activeRepo = getActiveRepo();
              if (!activeRepo) {
                throw new Error('Active repository is not defined. cannot apply diff');
              }
              if (payload.write_mode) {
                try {
                  // Usage tracking
                  const sessionId = getSessionId();
                  if (sessionId) {
                    this.usageTrackingManager.trackUsage({
                      eventType: 'GENERATED',
                      eventData: {
                        file_path: vscode.workspace.asRelativePath(vscode.Uri.parse(currentDiffRequest.filepath)),
                        lines: Math.abs(event.content.added_lines) + Math.abs(event.content.removed_lines),
                        source: payload.is_inline ? 'inline-chat-act' : 'act',
                      },
                      sessionId: sessionId,
                    });
                  }
                  const { diffApplySuccess, addedLines, removedLines } = await this.diffManager.applyDiffForSession(
                    {
                      path: currentDiffRequest.filepath,
                      incrementalUdiff: currentDiffRequest.raw_diff,
                    },
                    activeRepo,
                    {
                      usageTrackingSource: payload.is_inline ? 'inline-chat-act' : 'act',
                      usageTrackingSessionId: getSessionId() || null,
                    },
                    payload.write_mode,
                    sessionId as number,
                  );

                  if (diffApplySuccess) {
                    this.sidebarProvider?.sendMessageToSidebar({
                      id: uuidv4(),
                      command: 'file-diff-applied',
                      data: {
                        addedLines,
                        removedLines,
                        filePath: currentDiffRequest.filepath,
                        fileName: path.basename(currentDiffRequest.filepath),
                        repoPath: activeRepo,
                        sessionId: sessionId,
                      },
                    });
                  }

                  this.sidebarProvider?.sendMessageToSidebar({
                    id: messageId,
                    command: 'chunk',
                    data: {
                      name: 'APPLY_DIFF_RESULT',
                      data: diffApplySuccess ? { status: 'completed', addedLines, removedLines } : 'error',
                    },
                  });
                } catch (error: any) {
                  this.outputChannel.error(`Error in udiff apply: ${error.message}`);
                  this.sidebarProvider?.sendMessageToSidebar({
                    id: messageId,
                    command: 'chunk',
                    data: {
                      name: 'APPLY_DIFF_RESULT',
                      data: { status: 'error', addedLines: 0, removedLines: 0 },
                    },
                  });
                }
              }
              currentDiffRequest = null;
            } else {
              chunkCallback({ name: event.type, data: event.content });
            }
            break;
          }
          case 'MALFORMED_TOOL_USE_REQUEST': {
            this.outputChannel.error(`Malformed tool use request: ${JSON.stringify(event.content.reason)}`);
            this.logger.error(`Malformed tool use request: ${JSON.stringify(event.content.reason)}`);

            const errorData = event.content;
            const rawPayload = errorData?.raw_payload || 'No raw payload available';

            const query =
              `You tried to use a tool that is not available, or the request was malformed. ` +
              `Please check the tool name and parameters. Here's the raw payload:\n\n${rawPayload}` +
              `Do not apologize or mention the error, just continue with correct tool usage.`;

            // Build a retry payload safely
            const retryPayload = {
              ...originalPayload,
              query,
              batch_tool_responses: [],
              is_tool_response: false,
            };

            chunkCallback({ name: event.type, data: event.content });

            // Retry as a regular query instead of tool-use fallback
            await this.apiChat(retryPayload, chunkCallback);

            const errorEventData = {
              error_msg: 'Malformed tool use request',
              model: originalPayload.llm_model,
              errorData: errorData,
            };

            const sessionId = getSessionId();
            if (sessionId) {
              this.usageTrackingManager.trackUsage({
                eventType: 'MALFORMED_TOOL_USE_REQUEST',
                eventData: errorEventData,
                sessionId: sessionId,
              });
            }

            break;
          }

          default:
            chunkCallback({ name: event.type, data: event.content });
            break;
        }
      }

      // 3. Handle any remaining Tool Requests (parallel or single)
      if (pendingToolRequests.length > 0) {
        await this._runTool(pendingToolRequests, messageId, chunkCallback, clientTools);
      }

      // Signal end of stream.
      chunkCallback({ name: 'end', data: {} });
    } catch (error: any) {
      this.outputChannel.error(`Error during apiChat: ${error.message}`, error);
      this.onError(error);
      if (this.currentAbortController?.signal.aborted) {
        this.outputChannel.info('apiChat was cancelled.');
        return;
      }
      // If the error is due to throttling, we handle it specifically, by confimring instance
      if (error instanceof ThrottlingException) {
        this.outputChannel.warn('Throttling error detected, handling accordingly.');
        const errorData = error.data;
        const extraErrorInfo = {
          detail: errorData.detail,
          model: errorData.model,
          region: errorData.region,
        };

        this.errorTrackingManager.trackGeneralError(error, 'THROTTLING_ERROR', 'BACKEND', extraErrorInfo);

        chunkCallback({
          name: 'error',
          data: {
            payload_to_retry: originalPayload,
            error_msg: errorData.message,
            retry: true,
            errorType: 'THROTTLING_ERROR',
            model: originalPayload.llm_model,
            retry_after: errorData.retry_after || 60, // Default to 60 seconds if not provided
          },
        });
      } else if (error instanceof TokenLimitException) {
        const errorData = error.data;
        const extraErrorInfo = {
          detail: errorData.detail,
          model: errorData.model,
          current_tokens: errorData.current_tokens,
          max_tokens: errorData.max_tokens,
        };

        this.errorTrackingManager.trackGeneralError(error, 'TOKEN_LIMIT_ERROR', 'BACKEND', extraErrorInfo);

        chunkCallback({
          name: 'error',
          data: {
            payload_to_retry: originalPayload,
            error_msg: errorData.message,
            retry: true,
            errorType: 'TOKEN_LIMIT_ERROR',
            model: originalPayload.llm_model,
            current_tokens: errorData.current_tokens,
            max_tokens: errorData.max_tokens,
            query: originalPayload.query || '',
            better_models: errorData.better_models,
          },
        });
      } else {
        const extraErrorInfo = {
          chat_payload: truncatePayloadValues(payload, 100),
          error_message: typeof error.message === 'object' ? JSON.stringify(error.message) : error.message,
        };

        this.errorTrackingManager.trackGeneralError(error, 'CHAT_ERROR', 'EXTENSION', extraErrorInfo);

        // Send error details back to the UI for potential retry
        chunkCallback({
          name: 'error',
          data: {
            payload_to_retry: originalPayload,
            error_msg: String(error.message || error),
            retry: true, // Suggest retry is possible
          },
        });
      }
    } finally {
      // Cleanup: Unregister task and clear controller regardless of success/error/cancellation
      if (querySolverTask) {
        unregisterApiChatTask(querySolverTask);
      }
      this.currentAbortController = null;
      this.outputChannel.info('apiChat finished cleanup.');
    }
  }

  /**
   * Calls the backend API for batch chunk search (focused_snippets_searcher).
   */
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

  /**
   * Calls the backend API for file path search.
   */
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

  async _runIterativeFileReader(repoPath: string, filePath: string, startLine: number, endLine: number): Promise<any> {
    this.outputChannel.info(`Running iterative file reader for ${filePath}`);
    try {
      const response = await binaryApi().post(API_ENDPOINTS.ITERATIVELY_READ_FILE, {
        repo_path: repoPath,
        file_path: await resolveDirectoryRelative(filePath), // Ensures the file path is always relative
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
          directory_path: await resolveDirectoryRelative(search_path), // Ensures the search path is always relative
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
        const errorData: any = error?.response?.data;
        if (
          errorData &&
          errorData.error_subtype === 'EMPTY_TOOL_RESPONSE' &&
          errorData.error_type === 'HANDLED_TOOL_ERROR'
        ) {
          return {
            data: [],
            search_term: query,
            directory_path: search_path,
            case_insensitive: case_insensitive,
            use_regex: use_regex,
          };
        } else {
          this.logger.error(`Error calling Grep search API`);
          this.apiErrorHandler.handleApiError(error);
        }
      }
    }
  }

  async _runPublicUrlContentReader(payload: { urls: string[] }) {
    const authToken = await this.authService.loadAuthToken();
    const headers = {
      Authorization: `Bearer ${authToken}`,
      'X-Session-Type': SESSION_TYPE,
      'X-Session-Id': getSessionId(),
    };
    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.PUBLIC_URL_CONTENT_READER,
        { urls: payload.urls },
        { headers },
      );
      this.outputChannel.info('URL Read API call successful.');
      this.outputChannel.info(`URL Read result: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error('Error calling URL Read API');
      this.outputChannel.error('Error calling URL Read API: ', error);
      this.apiErrorHandler.handleApiError(error);
    }
  }

  async _runWebSearch(payload: { descriptive_query: string[] }) {
    const authToken = await this.authService.loadAuthToken();
    const headers = {
      Authorization: `Bearer ${authToken}`,
      'X-Session-Type': SESSION_TYPE,
      'X-Session-Id': getSessionId(),
    };
    try {
      const response = await api.post(
        API_ENDPOINTS.WEB_SEARCH,
        { descriptive_query: payload.descriptive_query },
        { headers },
      );
      if (response.status === 200) {
        this.outputChannel.info('Web Search API call successful.');
        this.outputChannel.info(`Web Search API result: ${JSON.stringify(response.data)}`);
        refreshCurrentToken(response.headers);
        return response.data;
      }
    } catch (error: any) {
      this.logger.error('Error calling Web Search API');
      this.outputChannel.error('Error calling Web Search API: ', error);
      const errorResponse = error.response?.data;
      if (errorResponse) {
        throw new Error(errorResponse.error.message);
      }
      throw new Error('Web Search failed due to unknow error.');
    }
  }

  private async _getToolUseApprovalStatus(toolUseId: string): Promise<ToolUseApprovalStatus> {
    return new Promise((resolve) => {
      const disposableApprove = this.onToolUseApprovalEvent((event) => {
        if (event.toolUseId === toolUseId) {
          disposableApprove.dispose();
          resolve({ approved: event.approved, autoAcceptNextTime: event.autoAcceptNextTime });
        }
      });
    });
  }

  /**
   * Routes a tool request to the appropriate handler based on the tool name.
   * Executes the tool, sends the TOOL_USE_RESULT to the UI, and then, if successful,
   * continues the chat flow by calling apiChat recursively with the tool's results.
   * This ensures the UI sees the tool completion before the next chat phase begins.
   *
   * @param toolRequest The details of the tool request.
   * @param messageId The original message ID for context.
   * @param chunkCallback Callback to send results back to the UI.
   */

  private async _runTool(
    toolRequests: ToolRequest[],
    messageId: string | undefined,
    chunkCallback: ChunkCallback,
    clientTools: Array<ClientTool>,
  ): Promise<void> {
    const isParallel = toolRequests.length > 1;

    this.outputChannel.info(
      `${isParallel ? 'Starting parallel execution of' : 'Running'} ${toolRequests.length} tool${toolRequests.length > 1 ? 's' : ''}`,
    );

    try {
      if (isParallel) {
        // Execute all tools in parallel and collect their responses
        const toolResults = await Promise.allSettled(
          toolRequests.map(async (toolRequest) => {
            const result = await this._runToolInternal(toolRequest, messageId, chunkCallback, clientTools, false);
            return { toolRequest, result, status: 'success' as const };
          }),
        );

        // Process results and collect successful responses
        const successfulResults: Array<{ toolRequest: ToolRequest; result: any; status: 'success' }> = [];

        toolResults.forEach((outcome, index) => {
          if (outcome.status === 'fulfilled') {
            successfulResults.push(outcome.value);
          } else {
            this.outputChannel.error(`Tool ${toolRequests[index].tool_name} failed: ${outcome.reason?.message}`);
          }
        });

        // Send all successful tool responses to backend in a single call
        if (successfulResults.length > 0) {
          await this._sendBatchedToolResponses(successfulResults, messageId, chunkCallback, clientTools);
        }
        this.outputChannel.info(`Completed parallel execution of ${toolRequests.length} tools`);
      } else {
        // Single tool execution with immediate API call
        const result = await this._runToolInternal(toolRequests[0], messageId, chunkCallback, clientTools, true);
        await this._sendBatchedToolResponses([result], messageId, chunkCallback, clientTools);
      }
    } catch (error: any) {
      this.outputChannel.error(`Error during tool execution: ${error.message}`, error);
      if (!isParallel) {
        // For single tool execution, error is already handled in _runToolInternal
        return;
      }
      throw error;
    }
  }

  private async _runToolInternal(
    toolRequest: ToolRequest,
    messageId: string | undefined,
    chunkCallback: ChunkCallback,
    clientTools: Array<ClientTool>,
    shouldMakeApiCall: boolean,
  ): Promise<any> {
    if (toolRequest.tool_name === 'create_new_workspace') return;

    this.outputChannel.info(`Running tool: ${toolRequest.tool_name} (ID: ${toolRequest.tool_use_id})`);

    if (this._isAborted()) return;

    try {
      const { activeRepo, parsedContent } = await this._prepareToolExecution(toolRequest);
      const detectedClientTool = this._findClientTool(toolRequest.tool_name, clientTools);

      const result = detectedClientTool
        ? await this._executeClientTool(detectedClientTool, parsedContent, toolRequest, chunkCallback)
        : await this._executeBuiltinTool(
            toolRequest.tool_name,
            activeRepo,
            parsedContent,
            chunkCallback,
            toolRequest,
            messageId,
          );

      if (this._isAborted()) return;

      await this._handleToolSuccess(
        result,
        toolRequest,
        messageId,
        chunkCallback,
        clientTools,
        parsedContent,
        detectedClientTool,
        shouldMakeApiCall,
      );
      return result;
    } catch (error: any) {
      await this._handleToolError(error, toolRequest, messageId, chunkCallback, clientTools);
      if (!shouldMakeApiCall) {
        // For parallel execution, propagate error to be handled at a higher level
        throw error;
      }
    }
  }

  /**
   * Send all collected tool responses to the backend in a single batch call
   */
  private async _sendBatchedToolResponses(
    toolResults: Array<{
      toolRequest: ToolRequest;
      result: any;
      status: 'success';
    }>,
    messageId: string | undefined,
    chunkCallback: ChunkCallback,
    clientTools: Array<ClientTool>,
  ): Promise<void> {
    if (toolResults.length === 0) {
      this.outputChannel.warn('No successful tool results to send to backend');
      return;
    }
    this.outputChannel.info(`Sending batch of ${toolResults.length} tool responses to backend`);

    const environmentDetails = await getEnvironmentDetails(true);
    const batchPayload: ChatPayload = {
      search_web: toolResults[0].toolRequest.search_web,
      llm_model: toolResults[0].toolRequest.llm_model,
      message_id: messageId,
      write_mode: toolResults[0].toolRequest.write_mode || false,
      is_tool_response: true,
      batch_tool_responses: toolResults.map(({ toolRequest, result }) => ({
        tool_name: toolRequest.tool_name,
        tool_use_id: toolRequest.tool_use_id,
        response: this._structureToolResponse(toolRequest.tool_name, result),
      })),
      os_name: await getOSName(),
      shell: getShell(),
      vscode_env: environmentDetails,
      client_tools: clientTools,
    };

    await this.apiChat(batchPayload, chunkCallback);
  }

  private _isAborted(): boolean {
    const aborted = this.currentAbortController?.signal.aborted;
    if (aborted) this.outputChannel.warn(`Tool execution aborted`);
    return !!aborted;
  }

  private async _prepareToolExecution(toolRequest: ToolRequest) {
    const activeRepo = getActiveRepo();
    if (!activeRepo) throw new Error('Active repository is not defined for running tool.');

    const parsedContent = this._parseToolContent(toolRequest.accumulatedContent);
    return { activeRepo, parsedContent };
  }

  private _parseToolContent(content: string): any {
    try {
      const parsed = JSON.parse(content);
      this.outputChannel.info(`Parsed tool parameters: ${JSON.stringify(parsed)}`);
      return parsed;
    } catch (error: any) {
      const message = `Failed to parse tool parameters JSON: ${error.message}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }

  private _findClientTool(toolName: string, clientTools: Array<ClientTool>): ClientTool | undefined {
    return clientTools.find((tool) => tool.name === toolName);
  }

  private async _executeClientTool(
    clientTool: ClientTool,
    parsedContent: any,
    toolRequest: ToolRequest,
    chunkCallback: ChunkCallback,
  ): Promise<any> {
    this.outputChannel.debug(`Running client tool: ${toolRequest.tool_name}`);

    await this._trackUsage('TOOL_USE_REQUEST_INITIATED', clientTool, toolRequest.tool_use_id);

    const approved = await this._handleApproval(clientTool, toolRequest, parsedContent, chunkCallback);
    if (!approved) return null;

    const result = await this.mcpManager.runMCPTool(
      clientTool.tool_metadata.server_id,
      clientTool.tool_metadata.tool_name,
      parsedContent,
    );

    await this._trackUsage('TOOL_USE_REQUEST_COMPLETED', clientTool, toolRequest.tool_use_id);
    this.outputChannel.debug(`Client tool result: ${JSON.stringify(result)}`);
    return result;
  }

  private async _handleApproval(
    clientTool: ClientTool,
    toolRequest: ToolRequest,
    parsedContent: any,
    chunkCallback: ChunkCallback,
  ): Promise<boolean> {
    if (clientTool.auto_approve) {
      await this._trackUsage('TOOL_USE_REQUEST_AUTO_APPROVED', clientTool, toolRequest.tool_use_id);
      return true;
    }

    this.outputChannel.info(`Tool ${toolRequest.tool_name} requires approval.`);
    const approval = await this._getToolUseApprovalStatus(toolRequest.tool_use_id);

    if (approval.autoAcceptNextTime) {
      this.outputChannel.info(`User opted to auto-approve future uses of tool ${toolRequest.tool_name}.`);
      this.mcpManager.approveMcpTool(clientTool.tool_metadata.server_id, clientTool.tool_metadata.tool_name);
    }

    const eventType = approval.approved ? 'TOOL_USE_REQUEST_APPROVED' : 'TOOL_USE_REQUEST_REJECTED';
    await this._trackUsage(eventType, clientTool, toolRequest.tool_use_id);

    if (!approval.approved) {
      await this._handleRejectedTool(toolRequest, clientTool, parsedContent, chunkCallback);
      return false;
    }

    return true;
  }

  private async _executeBuiltinTool(
    toolName: string,
    activeRepo: string,
    parsedContent: any,
    chunkCallback: ChunkCallback,
    toolRequest: ToolRequest,
    messageId: string | undefined,
  ): Promise<any> {
    const toolMap: Record<string, () => Promise<any>> = {
      related_code_searcher: () => this._runRelatedCodeSearcher(parsedContent.repo_path || activeRepo, parsedContent),
      focused_snippets_searcher: () =>
        this._runFocusedSnippetsSearcher(parsedContent.repo_path || activeRepo, parsedContent),
      file_path_searcher: () => this._runFilePathSearcher(parsedContent.repo_path || activeRepo, parsedContent),
      iterative_file_reader: () =>
        this._runIterativeFileReader(
          parsedContent.repo_path || activeRepo,
          parsedContent.file_path,
          parsedContent.start_line,
          parsedContent.end_line,
        ),
      grep_search: () =>
        this._runGrepSearch(
          parsedContent.search_path,
          parsedContent.repo_path || activeRepo,
          parsedContent.query,
          parsedContent.case_insensitive,
          parsedContent.use_regex,
        ),
      get_usage_tool: () =>
        this.getUsagesTool.getUsages({ symbolName: parsedContent.symbol_name, filePaths: parsedContent.file_paths }),
      resolve_import_tool: () =>
        this.getResolveModuleTool.resolveModule({
          importName: parsedContent.import_name,
          filePath: parsedContent.file_path,
        }),
      public_url_content_reader: () => this._runPublicUrlContentReader(parsedContent),
      execute_command: () =>
        this.terminalExecutor.runCommand({
          original: parsedContent.command,
          requiresApproval: parsedContent.requires_approval,
          isLongRunning: !!parsedContent.is_long_running,
          chunkCallback,
          toolRequest,
        }),
      web_search: () => this._runWebSearch(parsedContent),
      replace_in_file: () => this.replaceInFileTool.applyDiff({ parsedContent, chunkCallback, toolRequest, messageId }),
      write_to_file: () => this.writeToFileTool.applyDiff({ parsedContent, chunkCallback, toolRequest, messageId }),
    };

    const toolFunction = toolMap[toolName];
    if (!toolFunction) throw new Error(`Unknown tool requested: ${toolName}`);

    this.outputChannel.info(`Running ${toolName} with params: ${JSON.stringify(parsedContent)}`);
    return await toolFunction();
  }

  private async _handleToolSuccess(
    result: any,
    toolRequest: ToolRequest,
    messageId: string | undefined,
    chunkCallback: ChunkCallback,
    clientTools: Array<ClientTool>,
    parsedContent: any,
    detectedClientTool?: ClientTool,
    shouldMakeApiCall: boolean = true,
  ): Promise<void> {
    this.outputChannel.info(`Tool ${toolRequest.tool_name} completed successfully.`);

    if (detectedClientTool) {
      this._sendToolChipUpdate(chunkCallback, toolRequest, detectedClientTool, parsedContent, result, 'completed');
    } else {
      this._sendToolResult(chunkCallback, toolRequest, result, 'completed');
    }

    if (shouldMakeApiCall) {
      const continuationPayload = await this._createContinuationPayload(toolRequest, messageId, result, clientTools);
      await this.apiChat(continuationPayload, chunkCallback);
    }
  }

  private async _handleToolError(
    error: any,
    toolRequest: ToolRequest,
    messageId: string | undefined,
    chunkCallback: ChunkCallback,
    clientTools: Array<ClientTool>,
  ): Promise<void> {
    // if the tool request is of type ask_user_input and the error message is Unknown tool requested, we handle it differently
    if (toolRequest.tool_name === 'ask_user_input' && error.message.includes('Unknown tool requested')) {
      return;
    }

    if (this._isAborted()) return;

    this.logger.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`);
    this.outputChannel.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`, error);
    this.onError(error);
    this.errorTrackingManager.trackToolExecutionError(error, toolRequest);

    const errorResponse = this._formatErrorResponse(error);
    const detectedClientTool = this._findClientTool(toolRequest.tool_name, clientTools);

    if (detectedClientTool) {
      await this._trackUsage('TOOL_USE_REQUEST_FAILED', detectedClientTool, toolRequest.tool_use_id, error);
      this._sendToolChipUpdate(
        chunkCallback,
        toolRequest,
        detectedClientTool,
        toolRequest.accumulatedContent,
        { error: error.message },
        'error',
      );
    } else {
      this._sendToolResult(chunkCallback, toolRequest, { error: error.message }, 'error');
    }

    const retryPayload = await this._createRetryPayload(toolRequest, messageId, errorResponse, clientTools);
    await this.apiChat(retryPayload, chunkCallback);
  }

  private async _trackUsage(eventType: string, clientTool: ClientTool, toolUseId: string, error?: any): Promise<void> {
    const sessionId = getSessionId();
    if (!sessionId) return;

    this.usageTrackingManager.trackUsage({
      eventType,
      eventData: {
        toolRequest: {
          toolName: clientTool.name || clientTool.tool_metadata.tool_name,
          toolMeta: {
            toolName: clientTool.tool_metadata.tool_name,
            serverName: clientTool.tool_metadata.server_id,
          },
          requiresApproval: !clientTool.auto_approve,
        },
        toolUseId,
        ...(error && { error }),
      },
      sessionId,
    });
  }

  private _sendToolChipUpdate(
    chunkCallback: ChunkCallback,
    toolRequest: ToolRequest,
    clientTool: ClientTool,
    requestData: any,
    response: any,
    status: 'completed' | 'error',
  ): void {
    chunkCallback({
      name: 'TOOL_CHIP_UPSERT',
      data: {
        toolRequest: {
          requestData,
          toolName: toolRequest.tool_name,
          toolMeta: {
            toolName: clientTool.tool_metadata.tool_name,
            serverName: clientTool.tool_metadata.server_id,
          },
          requiresApproval: !clientTool.auto_approve,
        },
        toolResponse: response,
        toolRunStatus: status,
        toolUseId: toolRequest.tool_use_id,
      },
    });
  }

  private _sendToolResult(
    chunkCallback: ChunkCallback,
    currentToolRequest: ToolRequest,
    result: any,
    status: 'completed' | 'error',
  ): void {
    chunkCallback({
      name: 'TOOL_CHIP_UPSERT',
      data: {
        toolRequest: {
          requestData: currentToolRequest.accumulatedContent,
          toolName: currentToolRequest.tool_name,
        },
        toolResponse: result,
        toolRunStatus: status,
        toolUseId: currentToolRequest.tool_use_id,
      },
    });
  }

  private async _createContinuationPayload(
    toolRequest: ToolRequest,
    messageId: string | undefined,
    result: any,
    clientTools: Array<ClientTool>,
  ): Promise<ChatPayload> {
    const environmentDetails = await getEnvironmentDetails(true);
    return {
      search_web: toolRequest.search_web,
      llm_model: toolRequest.llm_model,
      message_id: messageId,
      write_mode: toolRequest.write_mode,
      is_tool_response: true,
      batch_tool_responses: [
        {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          response: this._structureToolResponse(toolRequest.tool_name, result),
        },
      ],
      os_name: await getOSName(),
      shell: getShell(),
      vscode_env: environmentDetails,
      client_tools: clientTools,
    };
  }

  private async _createRetryPayload(
    toolRequest: ToolRequest,
    messageId: string | undefined,
    errorResponse: any,
    clientTools: Array<ClientTool>,
  ): Promise<ChatPayload> {
    const environmentDetails = await getEnvironmentDetails(true);
    return {
      search_web: toolRequest.search_web,
      llm_model: toolRequest.llm_model,
      message_id: messageId,
      write_mode: toolRequest.write_mode,
      is_tool_response: true,
      tool_use_failed: true,
      batch_tool_responses: [
        {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          response: errorResponse,
        },
      ],
      os_name: await getOSName(),
      shell: getShell(),
      vscode_env: environmentDetails,
      client_tools: clientTools,
    };
  }

  private _formatErrorResponse(error: any): any {
    let errorResponse = error.response?.data;
    if (!errorResponse) {
      errorResponse = {
        error_code: 500,
        error_type: 'SERVER_ERROR',
        error_message: error.message,
      };
    }
    if (errorResponse?.traceback) delete errorResponse.traceback;
    return errorResponse;
  }

  private async _handleRejectedTool(
    toolRequest: ToolRequest,
    clientTool: ClientTool,
    parsedContent: any,
    chunkCallback: ChunkCallback,
  ): Promise<void> {
    const errorMessage =
      'This tool required user approval but the user did not approve it. Please clarify this with the user.';

    this.outputChannel.info(`Tool ${toolRequest.tool_name} was rejected by user.`);
    this._sendToolChipUpdate(chunkCallback, toolRequest, clientTool, parsedContent, null, 'error');
    this._sendToolResult(chunkCallback, toolRequest, { error_message: errorMessage }, 'error');

    const rejectedPayload = await this._createRetryPayload(toolRequest, undefined, { error_message: errorMessage }, []);
    await this.apiChat(rejectedPayload, chunkCallback);
  }

  /**
   * Structures the raw tool result into the format expected by the backend's tool_use_response.
   */
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

  // --- Specific Tool Implementations ---

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
        session_type: SESSION_TYPE,
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

  private async _runFilePathSearcher(
    repo_path: string,
    params: {
      directory?: string;
      search_terms?: string[];
    },
  ): Promise<any> {
    const directory = await resolveDirectoryRelative(params.directory);
    const searchTerms = params.search_terms; // Optional
    this.outputChannel.info(
      `Executing file_path_searcher: directory="${directory}", terms="${searchTerms?.join(', ')}"`,
    );
    return this._fetchFilePathSearch(repo_path, directory || '', searchTerms);
  }

  async apiClearChat() {
    // Implementation for clearing chat on the backend.
  }
  /**
   * Stops the currently active chat stream, if any.
   */
  async stopChat(): Promise<void> {
    cancelChat();
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.outputChannel.warn('Stopping active chat request...');
      // The finally block in apiChat handles unregistering and nulling the controller
    } else {
      this.outputChannel.info('No active chat request to stop.');
    }
  }

  async apiSaveSession() {
    // Implementation for saving the chat session.
  }

  async apiChatSetting() {
    // Implementation for updating chat settings.
  }
  public async killAllProcesses() {
    await this.terminalExecutor.abortAllCommands();
  }
  public async killProcessById(tool_use_id: string) {
    await this.terminalExecutor.abortCommand(tool_use_id);
  }

  /**
   * Determines the provider from the model name
   */
  private getProviderFromModel(model?: string): string {
    if (!model) return 'unknown';

    const lowerModel = model.toLowerCase();
    if (lowerModel.includes('claude') || lowerModel.includes('anthropic')) {
      return 'anthropic';
    } else if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
      return 'openai';
    } else if (lowerModel.includes('gemini') || lowerModel.includes('google')) {
      return 'google';
    }

    return 'unknown';
  }
}
