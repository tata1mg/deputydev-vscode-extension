import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { fetchRelevantChunks } from '../clients/common/websocketHandlers';
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
import { QuerySolverService } from '../services/chat/ChatService';
import { FocusChunksService } from '../services/focusChunks/focusChunksService';
import { HistoryService } from '../services/history/HistoryService';
import { getShell } from '../terminal/utils/shell';
import { ChatPayload, Chunk, ChunkCallback, ClientTool, SearchTerm, ToolRequest, ToolUseResult } from '../types';
import { UsageTrackingManager } from '../analyticsTracking/UsageTrackingManager';
import { ErrorTrackingManager } from '../analyticsTracking/ErrorTrackingManager';
import { getActiveRepo, getSessionId, setSessionId } from '../utilities/contextManager';
import { getOSName } from '../utilities/osName';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { registerApiChatTask, unregisterApiChatTask } from './ChatCancellationManager';
import { ReplaceInFile } from './tools/ReplaceInFileTool';
import { TerminalExecutor } from './tools/TerminalTool';
import { WriteToFileTool } from './tools/WriteToFileTool';
import { truncatePayloadValues } from '../utilities/errorTrackingHelper';

interface ToolUseApprovalStatus {
  approved: boolean;
  autoAcceptNextTime: boolean;
}
export class ChatManager {
  private querySolverService = new QuerySolverService(this.context, this.outputChannel);
  private sidebarProvider?: SidebarProvider; // Optional at first
  private historyService = new HistoryService();
  private focusChunksService = new FocusChunksService();
  private authService = new AuthService();
  private currentAbortController: AbortController | null = null;
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  public _onTerminalApprove = new vscode.EventEmitter<{ toolUseId: string; command: string }>();
  public _onToolUseApprove = new vscode.EventEmitter<{
    toolUseId: string;
    autoAcceptNextTime: boolean;
    approved: boolean;
  }>();
  public onTerminalApprove = this._onTerminalApprove.event;
  public onToolUseApprovalEvent = this._onToolUseApprove.event;
  private terminalExecutor: TerminalExecutor;
  private replaceInFileTool!: ReplaceInFile;
  private writeToFileTool!: WriteToFileTool;
  // private mcpManager: MCPManager;

  onStarted: () => void = () => {};
  onError: (error: Error) => void = () => {};
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
    private diffManager: DiffManager,
    private apiErrorHandler: ApiErrorHandler,
    private mcpManager: MCPManager,
    private usageTrackingManager: UsageTrackingManager,
    private errorTrackingManager: ErrorTrackingManager,
  ) {
    this.apiErrorHandler = new ApiErrorHandler();
    this.logger = SingletonLogger.getInstance();
    this.terminalExecutor = new TerminalExecutor(this.context, this.logger, this.onTerminalApprove, this.outputChannel);
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

  async getFocusChunks(data: ChatPayload): Promise<string[]> {
    const active_repo = getActiveRepo();
    if (!active_repo) {
      throw new Error('Active repository is not defined.');
    }

    const finalResult: Array<any> = [];
    this.outputChannel.info(`Reference list: ${JSON.stringify(data.referenceList)}`);
    try {
      // wait for all the async operations to finish
      await Promise.all(
        (data.referenceList ?? []).map(async (element) => {
          let chunkDetails: Array<Chunk> = [];
          if (element.chunks !== null) {
            chunkDetails = chunkDetails.concat(element.chunks);
          }

          this.outputChannel.info(`chunks: ${JSON.stringify(chunkDetails)}`);

          // Call the external function to fetch relevant chunks.
          const result = chunkDetails.length
            ? await this.focusChunksService.getFocusChunks({
                auth_token: await this.authService.loadAuthToken(),
                repo_path: active_repo,
                chunks: chunkDetails,
                search_item_name: element.value,
                search_item_type: element.type,
                search_item_path: element.path,
              })
            : [];

          const finalChunkInfos: Array<any> = [];
          if (result.length) {
            result.forEach((chunkInfoWithHash: any) => {
              const chunkInfo = chunkInfoWithHash.chunk_info;
              finalChunkInfos.push(chunkInfo);
            });
          }

          finalResult.push({
            type: element.type,
            value: element.value,
            chunks: finalChunkInfos || null,
            path: element.path,
          });
        }),
      );

      return finalResult;
    } catch (error) {
      this.outputChannel.error(`Error fetching focus chunks: ${error}`);
      return [];
    }
  }

  /**
   * Fetches relevant previous chat messages from the current session based on the new query.
   * @param currentSessionId The ID of the current chat session.
   * @param query The current user query.
   * @returns An object containing the concatenated text of relevant history and their IDs.
   */
  private async _fetchRelevantHistory(
    currentSessionId: number,
    query: string,
  ): Promise<{ text?: string; ids: number[] }> {
    this.outputChannel.info(
      `Fetching relevant history for session ${currentSessionId} and query "${query.substring(0, 50)}..."`,
    );
    try {
      const relevantHistoryData = await this.historyService.getRelevantChatHistory(currentSessionId, query);
      const relevantHistoryChats = relevantHistoryData?.chats || [];

      if (!relevantHistoryChats.length) {
        this.outputChannel.info('No relevant chat history found.');
        return { ids: [] };
      }

      let combinedText = '';
      const ids: number[] = [];
      for (const chat of relevantHistoryChats) {
        // Combine query and response for context
        combinedText += `User: ${chat.query}\nAssistant: ${chat.response}\n\n`;
        ids.push(chat.id);
      }

      this.outputChannel.info(`Found ${ids.length} relevant history items.`);
      // this.outputChannel.debug(`Relevant history text: ${combinedText}`); // Can be very verbose
      return { text: combinedText.trim(), ids };
    } catch (error: any) {
      this.outputChannel.error(`Error fetching relevant chat history: ${error.message}`, error);
      this.onError(error);
      return { ids: [] }; // Return empty on error
    }
  }

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
      const currentSessionId = getSessionId();
      if (currentSessionId && payload.query && !payload.is_tool_response) {
        const { ids: relevantHistoryQueryIds } = await this._fetchRelevantHistory(currentSessionId, payload.query);
        if (relevantHistoryQueryIds.length > 0) {
          payload.previous_query_ids = relevantHistoryQueryIds;
        }
      }

      if (payload.referenceList) {
        const focus_chunks = await this.getFocusChunks(payload);
        payload.focus_items = focus_chunks;
      }
      delete payload.referenceList;

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
      payload.vscode_env = await getEnvironmentDetails(true);

      const clientTools = await this.getExtraTools();
      payload.client_tools = clientTools;

      this.outputChannel.info('Payload prepared for QuerySolverService.');
      // console.log(payload)
      this.outputChannel.info(`Processed payload: ${JSON.stringify(payload)}`);

      // 2. Call Query Solver Service and Register Task for Cancellation
      const querySolverIterator = this.querySolverService.querySolver(payload, abortController.signal);
      querySolverTask = { abortController, asyncIterator: querySolverIterator };
      registerApiChatTask(querySolverTask);

      this.outputChannel.info('QuerySolverService called, listening for events...');

      let currentToolRequest: ToolRequest | null = null;
      let currentDiffRequest: any = null;

      for await (const event of querySolverIterator) {
        if (abortController.signal.aborted) {
          this.outputChannel.warn('apiChat aborted by cancellation signal.');
          break; // Exit loop if cancelled
        }
        switch (event.type) {
          case 'RESPONSE_METADATA':
            if (event.content?.session_id) {
              // Set session ID if not already set
              setSessionId(event.content.session_id);
              this.outputChannel.info(`Session ID set: ${event.content.session_id}`);
            }
            chunkCallback({ name: event.type, data: event.content });
            break;

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
              chunkCallback({ name: event.type, data: event.content });
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
                  name: event.type,
                  data: {
                    tool_name: currentToolRequest.tool_name,
                    tool_use_id: currentToolRequest.tool_use_id,
                    delta: event.content?.input_params_json_delta || '',
                  },
                });
              }
            }
            break;
          }
          case 'TOOL_USE_REQUEST_END': {
            if (currentToolRequest) {
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
                  name: event.type,
                  data: {
                    tool_name: currentToolRequest.tool_name,
                    tool_use_id: currentToolRequest.tool_use_id,
                  },
                });
              }
            }
            break;
          }
          case 'CODE_BLOCK_START':
            if (event.content?.is_diff && !(payload.write_mode && payload.llm_model === 'GPT_4_POINT_1')) {
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

          default:
            chunkCallback({ name: event.type, data: event.content });
            break;
        }
      }

      // 3. Handle Tool Requests
      if (currentToolRequest) {
        await this._runTool(currentToolRequest, messageId, chunkCallback, clientTools);
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
      const extraErrorInfo = {
        chat_payload: truncatePayloadValues(payload, 100),
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
    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.ITERATIVELY_READ_FILE,
        {
          repo_path: repoPath,
          file_path: filePath,
          start_line: startLine,
          end_line: endLine,
        },
        { headers },
      );

      this.outputChannel.info('Iterative file reader API call successful.');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling Iterative file reader API: ${error.message}`);
      this.outputChannel.error(`Error calling Iterative file reader API: ${error.message}`, error);
      this.apiErrorHandler.handleApiError(error);
    }
  }

  async _runGrepSearch(directoryPath: string, repoPath: string, searchTerms?: string[]): Promise<any> {
    this.outputChannel.info(`Running grep search tool for ${directoryPath}`);
    const authToken = await this.authService.loadAuthToken();
    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      const response = await binaryApi().post(
        API_ENDPOINTS.GREP_SEARCH,
        {
          repo_path: repoPath,
          directory_path: directoryPath,
          search_terms: searchTerms,
        },
        { headers },
      );

      this.outputChannel.info('Grep search API call successful.');
      this.outputChannel.info(`Grep search result: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error calling Grep search API`);
      this.apiErrorHandler.handleApiError(error);
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
    toolRequest: ToolRequest,
    messageId: string | undefined,
    chunkCallback: ChunkCallback,
    clientTools: Array<ClientTool>,
  ): Promise<void> {
    this.outputChannel.info(`Running tool: ${toolRequest.tool_name} (ID: ${toolRequest.tool_use_id})`);
    if (this.currentAbortController?.signal.aborted) {
      this.outputChannel.warn(`_runTool aborted before starting tool: ${toolRequest.tool_name}`);
      return;
    }
    let rawResult: any;
    let status: 'completed' | 'error' = 'error'; // Default to error
    let resultForUI: any; // This will hold what's sent in TOOL_USE_RESULT
    if (toolRequest.tool_name == 'create_new_workspace') {
      this.outputChannel.info(`Running create_new_workspace tool`);
      return;
    }
    try {
      const active_repo = getActiveRepo();
      if (!active_repo) {
        throw new Error('Active repository is not defined for running tool.');
      }

      let parsedContent: any;
      try {
        parsedContent = JSON.parse(toolRequest.accumulatedContent);
        this.outputChannel.info(`Parsed tool parameters: ${JSON.stringify(parsedContent)}`);
      } catch (parseError: any) {
        this.logger.error(`Failed to parse tool parameters JSON: ${parseError.message}`);
        throw new Error(`Failed to parse tool parameters JSON: ${parseError.message}`);
      }

      // check if tool request is for client tool
      const detectedClientTool = clientTools.find((x) => x.name === toolRequest.tool_name);

      if (detectedClientTool) {
        this.outputChannel.debug(`Running client tool: ${toolRequest.tool_name}`);
        // tool use request for mcp (user tracking)
        const sessionId = getSessionId();
        if (sessionId) {
          this.usageTrackingManager.trackUsage({
            eventType: 'TOOL_USE_REQUEST_INITIATED',
            eventData: {
              toolRequest: {
                toolName: toolRequest.tool_name,
                toolMeta: {
                  toolName: detectedClientTool.tool_metadata.tool_name,
                  serverName: detectedClientTool.tool_metadata.server_id,
                },
                requiresApproval: !detectedClientTool.auto_approve,
              },
              toolUseId: toolRequest.tool_use_id,
            },
            sessionId: sessionId,
          });
        }
        // if approval is needed, wait for it

        let approvalStatus: ToolUseApprovalStatus = {
          approved: true, // Default to true, will be updated if approval is needed
          autoAcceptNextTime: false, // Default to false
        };

        if (!detectedClientTool.auto_approve) {
          this.outputChannel.info(`Tool ${toolRequest.tool_name} requires approval.`);
          approvalStatus = await this._getToolUseApprovalStatus(toolRequest.tool_use_id);
          if (approvalStatus.autoAcceptNextTime) {
            this.outputChannel.info(`User opted to auto-approve future uses of tool ${toolRequest.tool_name}.`);
            this.mcpManager.approveMcpTool(
              detectedClientTool.tool_metadata.server_id,
              detectedClientTool.tool_metadata.tool_name,
            );
          }
        } else {
          // tool use auto approve (user tracking)
          const sessionId = getSessionId();
          if (sessionId) {
            this.usageTrackingManager.trackUsage({
              eventType: 'TOOL_USE_REQUEST_AUTO_APPROVED',
              eventData: {
                toolRequest: {
                  toolName: toolRequest.tool_name,
                  toolMeta: {
                    toolName: detectedClientTool.tool_metadata.tool_name,
                    serverName: detectedClientTool.tool_metadata.server_id,
                  },
                  requiresApproval: !detectedClientTool.auto_approve,
                },
                toolUseId: toolRequest.tool_use_id,
              },
              sessionId: sessionId,
            });
          }
        }

        if (!approvalStatus.approved) {
          // tool use rejected (user tracking)
          const sessionId = getSessionId();
          if (sessionId) {
            this.usageTrackingManager.trackUsage({
              eventType: 'TOOL_USE_REQUEST_REJECTED',
              eventData: {
                toolRequest: {
                  toolName: toolRequest.tool_name,
                  toolMeta: {
                    toolName: detectedClientTool.tool_metadata.tool_name,
                    serverName: detectedClientTool.tool_metadata.server_id,
                  },
                  requiresApproval: !detectedClientTool.auto_approve,
                },
                toolUseId: toolRequest.tool_use_id,
              },
              sessionId: sessionId,
            });
          }
          this.outputChannel.info(`Tool ${toolRequest.tool_name} was rejected by user.`);
          chunkCallback({
            name: 'TOOL_CHIP_UPSERT',
            data: {
              toolRequest: {
                requestData: parsedContent,
                toolName: toolRequest.tool_name,
                toolMeta: {
                  toolName: detectedClientTool.tool_metadata.tool_name,
                  serverName: detectedClientTool.tool_metadata.server_id,
                },
                requiresApproval: !detectedClientTool.auto_approve,
              },
              toolResponse: null,
              toolRunStatus: 'error',
              toolUseId: toolRequest.tool_use_id,
            },
          });
          // Send TOOL_USE_RESULT with error response
          const resultStatus: 'completed' | 'error' = 'error';
          const toolUseResult = {
            name: 'TOOL_USE_RESULT',
            data: {
              tool_name: toolRequest.tool_name,
              tool_use_id: toolRequest.tool_use_id,
              result_json: {
                error_message: `This tool required user approval but the user did not approve it. Please clarify this with the user.`,
              },
              status: resultStatus,
            },
          };
          chunkCallback(toolUseResult);
          const EnvironmentDetails = await getEnvironmentDetails(true);
          const toolUseRejectedPayload = {
            search_web: toolRequest.search_web,
            llm_model: toolRequest.llm_model,
            message_id: messageId, // Pass original message ID for context if needed by UI later
            write_mode: toolRequest.write_mode,
            is_tool_response: true,
            tool_use_failed: true,
            tool_use_response: {
              tool_name: toolRequest.tool_name,
              tool_use_id: toolRequest.tool_use_id,
              response: {
                error_message: `This tool required user approval but the user did not approve it. Please clarify this with the user.`,
              },
            },
            os_name: await getOSName(),
            shell: getShell(),
            vscode_env: EnvironmentDetails,
            client_tools: clientTools,
          };
          await this.apiChat(toolUseRejectedPayload, chunkCallback);
          return; // Exit early if tool use was rejected
        }
        if (!detectedClientTool.auto_approve) {
          // manualy approved tool use for user tracking
          const sessionId = getSessionId();
          if (sessionId) {
            this.usageTrackingManager.trackUsage({
              eventType: 'TOOL_USE_REQUEST_APPROVED',
              eventData: {
                toolRequest: {
                  toolName: toolRequest.tool_name,
                  toolMeta: {
                    toolName: detectedClientTool.tool_metadata.tool_name,
                    serverName: detectedClientTool.tool_metadata.server_id,
                  },
                  requiresApproval: !detectedClientTool.auto_approve,
                },
                toolUseId: toolRequest.tool_use_id,
              },
              sessionId: sessionId,
            });
          }
        }
        rawResult = await this.mcpManager.runMCPTool(
          detectedClientTool.tool_metadata.server_id,
          detectedClientTool.tool_metadata.tool_name,
          parsedContent,
        );
        // tool use completed user tracking
        if (sessionId) {
          this.usageTrackingManager.trackUsage({
            eventType: 'TOOL_USE_REQUEST_COMPLETED',
            eventData: {
              toolRequest: {
                toolName: toolRequest.tool_name,
                toolMeta: {
                  toolName: detectedClientTool.tool_metadata.tool_name,
                  serverName: detectedClientTool.tool_metadata.server_id,
                },
                requiresApproval: !detectedClientTool.auto_approve,
              },
              toolUseId: toolRequest.tool_use_id,
            },
            sessionId: sessionId,
          });
        }
        this.outputChannel.debug(`Client tool result: ${JSON.stringify(rawResult)}`);
      } else {
        // Execute the specific tool function
        switch (toolRequest.tool_name) {
          case 'related_code_searcher':
            rawResult = await this._runRelatedCodeSearcher(active_repo, parsedContent);
            break;
          case 'focused_snippets_searcher':
            rawResult = await this._runFocusedSnippetsSearcher(active_repo, parsedContent);
            break;
          case 'file_path_searcher':
            this.outputChannel.info(`Running file_path_searcher with params: ${JSON.stringify(parsedContent)}`);
            rawResult = await this._runFilePathSearcher(active_repo, parsedContent);
            break;
          case 'iterative_file_reader':
            this.outputChannel.info(`Running iterative_file_reader with params: ${JSON.stringify(parsedContent)}`);
            rawResult = await this._runIterativeFileReader(
              active_repo,
              parsedContent.file_path,
              parsedContent.start_line,
              parsedContent.end_line,
            );
            break;
          case 'grep_search':
            this.outputChannel.info(`Running grep_search with params: ${JSON.stringify(parsedContent)}`);
            rawResult = await this._runGrepSearch(
              parsedContent.directory_path,
              active_repo,
              parsedContent.search_terms,
            );
            break;
          case 'public_url_content_reader':
            this.outputChannel.info(`Running public_url_content_reader with params: ${JSON.stringify(parsedContent)}`);
            rawResult = await this._runPublicUrlContentReader(parsedContent);
            break;
          case 'execute_command': {
            this.outputChannel.info(`Running execute_command with params: ${JSON.stringify(parsedContent)}`);

            rawResult = await this.terminalExecutor.runCommand({
              original: parsedContent.command,
              requiresApproval: parsedContent.requires_approval,
              isLongRunning: !!parsedContent.is_long_running,
              chunkCallback,
              toolRequest,
            });

            break;
          }
          case 'web_search':
            this.outputChannel.info(`Running web_search with params: ${JSON.stringify(parsedContent)}`);
            rawResult = await this._runWebSearch(parsedContent);
            break;

          case 'replace_in_file':
            this.outputChannel.info(`Running replace_in_file with params: ${JSON.stringify(parsedContent)}`);
            rawResult = await this.replaceInFileTool.applyDiff({
              parsedContent,
              chunkCallback,
              toolRequest,
              messageId,
            });
            break;
          case 'write_to_file':
            this.outputChannel.info(`Running write_to_file with params: ${JSON.stringify(parsedContent)}`);
            rawResult = await this.writeToFileTool.applyDiff({ parsedContent, chunkCallback, toolRequest, messageId });
            break;
          default: {
            this.outputChannel.warn(`Unknown tool requested: ${toolRequest.tool_name}`);
            // Treat as completed but with a message indicating it's unknown
            rawResult = {
              message: `Tool '${toolRequest.tool_name}' is not implemented.`,
            };
            // We will still send TOOL_USE_RESULT, but won't recurse apiChat
            status = 'completed';
            resultForUI = rawResult; // Send the message back
            // Send TOOL_USE_RESULT immediately as no continuation payload needed
            const detectedClientTool = clientTools.find((x) => x.name === toolRequest.tool_name);
            if (detectedClientTool) {
              chunkCallback({
                name: 'TOOL_CHIP_UPSERT',
                data: {
                  toolRequest: {
                    requestData: parsedContent,
                    toolName: toolRequest.tool_name,
                    toolMeta: {
                      serverName: detectedClientTool.tool_metadata.server_id,
                      toolName: detectedClientTool.tool_metadata.tool_name,
                    },
                    requiresApproval: !detectedClientTool.auto_approve,
                  },
                  toolResponse: resultForUI,
                  toolRunStatus: 'completed',
                  toolUseId: toolRequest.tool_use_id,
                },
              });
            } else {
              chunkCallback({
                name: 'TOOL_USE_RESULT',
                data: {
                  tool_name: toolRequest.tool_name,
                  tool_use_id: toolRequest.tool_use_id,
                  result_json: resultForUI,
                  status: status,
                },
              });
            }
            return; // Exit _runTool early for unknown tools
          }
        }
      }

      if (this.currentAbortController?.signal.aborted) {
        this.outputChannel.warn(`_runTool aborted after executing tool: ${toolRequest.tool_name}`);
        return;
      }

      // Check if the tool function executed successfully and returned a valid result
      // (null/undefined might indicate an internal tool error not caught)
      status = 'completed';
      resultForUI = rawResult; // The raw result is usually what the UI might want to display
      this.outputChannel.info(`Tool ${toolRequest.tool_name} completed successfully.`);

      // Prepare payload to continue chat with the tool's response
      const structuredResponse = this._structureToolResponse(toolRequest.tool_name, rawResult);
      const EnvironmentDetails = await getEnvironmentDetails(true);
      const continuationPayload: ChatPayload = {
        search_web: toolRequest.search_web,
        llm_model: toolRequest.llm_model,
        message_id: messageId, // Pass original message ID for context if needed by UI later
        write_mode: toolRequest.write_mode,
        is_tool_response: true,
        tool_use_response: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          response: structuredResponse, // Use the structured response for the backend
        },
        os_name: await getOSName(),
        shell: getShell(),
        vscode_env: EnvironmentDetails,
        client_tools: clientTools,
        // TODO: Consider if previous_query_ids need to be passed down through tool calls
      };

      // *** CRITICAL STEP ***
      // Send TOOL_USE_RESULT *before* awaiting the recursive apiChat call.
      // This ensures the UI knows this tool finished before the next phase starts.
      const toolUseResult = {
        name: 'TOOL_USE_RESULT',
        data: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          result_json: resultForUI, // Send the raw result to UI
          status: status,
        },
      };
      if (detectedClientTool) {
        chunkCallback({
          name: 'TOOL_CHIP_UPSERT',
          data: {
            toolRequest: {
              requestData: parsedContent,
              toolName: toolRequest.tool_name,
              toolMeta: {
                toolName: detectedClientTool.tool_metadata.tool_name,
                serverName: detectedClientTool.tool_metadata.server_id,
              },
              requiresApproval: !detectedClientTool.auto_approve,
            },
            toolResponse: resultForUI,
            toolRunStatus: 'completed',
            toolUseId: toolRequest.tool_use_id,
          },
        });
      }

      // Now, continue the chat flow with the tool response
      this.outputChannel.info(`Continuing chat after ${toolRequest.tool_name} result.`);
      chunkCallback(toolUseResult);
      await this.apiChat(continuationPayload, chunkCallback);
    } catch (error: any) {
      // raw error in json
      this.logger.error(`Raw error new: ${JSON.stringify(error)}`);
      let errorResponse = error.response?.data;
      if (!errorResponse) {
        errorResponse = {
          error_code: 500,
          error_type: 'SERVER_ERROR',
          error_message: error.message,
        };
      }
      this.errorTrackingManager.trackToolExecutionError(error, toolRequest);
      if (errorResponse && errorResponse.traceback) {
        delete errorResponse.traceback;
      }
      if (this.currentAbortController?.signal.aborted) {
        this.outputChannel.warn(`_runTool aborted during execution: ${toolRequest.tool_name}`);
        return;
      }
      this.logger.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`);
      this.outputChannel.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`, error);
      this.onError(error);
      status = 'error';
      resultForUI = { error: error.message }; // Set result to error message for UI

      // Send error result back to UI
      // No recursive apiChat call should happen on error.
      const toolUseResult = {
        name: 'TOOL_USE_RESULT',
        data: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          result_json: resultForUI, // Send the raw result to UI
          status: status,
        },
      };
      chunkCallback(toolUseResult);
      const detectedClientTool = clientTools.find((x) => x.name === toolRequest.tool_name);
      if (detectedClientTool) {
        // user tracking for error tool use
        const sessionId = getSessionId();
        if (sessionId) {
          this.usageTrackingManager.trackUsage({
            eventType: 'TOOL_USE_REQUEST_FAILED',
            eventData: {
              toolRequest: {
                toolName: toolRequest.tool_name,
                toolMeta: {
                  toolName: detectedClientTool.tool_metadata.tool_name,
                  serverName: detectedClientTool.tool_metadata.server_id,
                },
                requiresApproval: !detectedClientTool.auto_approve,
              },
              toolUseId: toolRequest.tool_use_id,
              error: error,
            },
            sessionId: sessionId,
          });
        }
        chunkCallback({
          name: 'TOOL_CHIP_UPSERT',
          data: {
            toolRequest: {
              requestData: toolRequest.accumulatedContent,
              toolName: toolRequest.tool_name,
              toolMeta: {
                toolName: detectedClientTool.tool_metadata.tool_name,
                serverName: detectedClientTool.tool_metadata.server_id,
              },
              requiresApproval: !detectedClientTool.auto_approve,
            },
            toolResponse: resultForUI,
            toolRunStatus: 'error',
            toolUseId: toolRequest.tool_use_id,
          },
        });
      }
      const EnvironmentDetails = await getEnvironmentDetails(true);
      // Do NOT continue chat if the tool itself failed critically
      const toolUseRetryPayload = {
        search_web: toolRequest.search_web,
        llm_model: toolRequest.llm_model,
        message_id: messageId, // Pass original message ID for context if needed by UI later
        write_mode: toolRequest.write_mode,
        is_tool_response: true,
        tool_use_failed: true,
        tool_use_response: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          response: errorResponse,
        },
        os_name: await getOSName(),
        shell: getShell(),
        vscode_env: EnvironmentDetails,
        client_tools: clientTools,
      };
      await this.apiChat(toolUseRetryPayload, chunkCallback);
    }
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
    repoPath: string,
    params: { search_query?: string; paths?: string[] },
  ): Promise<any> {
    const query = params.search_query || '';
    // const focusFiles = params.paths || []; // Currently unused based on original code?
    const currentSessionId = getSessionId();

    if (!currentSessionId) {
      throw new Error('Session ID is required for related_code_searcher');
    }
    this.outputChannel.info(`Executing related_code_searcher: query="${query.substring(0, 50)}..."`);

    try {
      const result = await fetchRelevantChunks({
        repo_path: repoPath,
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

  private async _runFocusedSnippetsSearcher(repoPath: string, params: { search_terms?: SearchTerm[] }): Promise<any> {
    const searchTerms = params.search_terms;
    if (!searchTerms || !searchTerms.length) {
      throw new Error("Missing 'search_terms' parameter for focused_snippets_searcher");
    }
    this.outputChannel.info(`Executing focused_snippets_searcher with ${searchTerms.length} terms.`);
    // return this._fetchBatchChunksSearch(repoPath, searchTerms);
    return this._fetchBatchChunksSearch(repoPath, searchTerms);
  }

  private async _runFilePathSearcher(
    repoPath: string,
    params: { directory?: string; search_terms?: string[] },
  ): Promise<any> {
    const directory = params.directory;
    const searchTerms = params.search_terms; // Optional
    this.outputChannel.info(
      `Executing file_path_searcher: directory="${directory}", terms="${searchTerms?.join(', ')}"`,
    );
    return this._fetchFilePathSearch(repoPath, directory || '', searchTerms);
  }

  async apiClearChat() {
    // Implementation for clearing chat on the backend.
  }
  /**
   * Stops the currently active chat stream, if any.
   */
  async stopChat(): Promise<void> {
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
}
