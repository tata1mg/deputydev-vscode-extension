// import * as path from 'node:path';
import { join } from "path";
import * as vscode from "vscode";
import { DiffViewManager } from "../diff/DiffManager";
import { SidebarProvider } from "../panels/SidebarProvider";
import { binaryApi } from "../services/api/axios";
import { API_ENDPOINTS } from "../services/api/endpoints";
import { QuerySolverService } from "../services/chat/ChatService";
import { fetchRelevantChunks } from "../clients/common/websocketHandlers";
import {
  getActiveRepo,
  getSessionId,
  setSessionId,
} from "../utilities/contextManager";
import { HistoryService } from "../services/history/HistoryService";
import { FocusChunksService } from "../services/focusChunks/focusChunksService";
import { AuthService } from "../services/auth/AuthService";
import { registerApiChatTask, unregisterApiChatTask } from './ChatCancellationManager';
import { SESSION_TYPE } from "../constants";
import { ChatPayload, ChunkCallback, Chunk, ToolRequest, CurrentDiffRequest, SearchTerm } from "../types";
import { SingletonLogger } from "../utilities/Singleton-logger";
import * as fs from "fs";
import * as path from "path";
import { UsageTrackingManager } from "../usageTracking/UsageTrackingManager";
import { UsageTrackingRequest } from "../types";
import osName from "os-name"
import { getShell } from "../terminal/utils/shell";
import { TerminalManager } from "../terminal/TerminalManager";


export class ChatManager {
  private querySolverService = new QuerySolverService(this.context);
  private sidebarProvider?: SidebarProvider; // Optional at first
  private historyService = new HistoryService();
  private focusChunksService = new FocusChunksService();
  private authService = new AuthService();
  private currentAbortController: AbortController | null = null;
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  public _onTerminalApprove = new vscode.EventEmitter<{ toolUseId: string }>();
  public onTerminalApprove = this._onTerminalApprove.event;

  onStarted: () => void = () => { };
  onError: (error: Error) => void = () => { };
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
    private diffViewManager: DiffViewManager,
    private terminalManager: TerminalManager,
  ) {
    this.logger = SingletonLogger.getInstance();
  }

  // Method to set the sidebar provider later
  setSidebarProvider(sidebarProvider: SidebarProvider) {
    this.sidebarProvider = sidebarProvider;
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
    this.logger.info("Stopping deputydev binary service...");
    this.outputChannel.info("Stopping deputydev binary service...");
  }

  async getFocusChunks(
    data: ChatPayload,
  ): Promise<string[]> {


    let chunkDetails: Array<Chunk> = [];

    this.outputChannel.info(`Reference list: ${JSON.stringify(data.referenceList)}`);
    data.referenceList?.forEach((element) => {
      if (element.chunks !== null) {
        chunkDetails = chunkDetails.concat(element.chunks);
      }
    });

    this.outputChannel.info(`chunks: ${JSON.stringify(chunkDetails)}`);

    try {
      // Retrieve the active repository path.
      const active_repo = getActiveRepo();
      if (!active_repo) {
        throw new Error("Active repository is not defined.");
      }

      // Call the external function to fetch relevant chunks.
      const result = chunkDetails.length ? await this.focusChunksService.getFocusChunks({
        auth_token: await this.authService.loadAuthToken(),
        repo_path: active_repo,
        chunks: chunkDetails,
        search_item_name: data.referenceList?.[0]?.value,
        search_item_type: data.referenceList?.[0]?.type,
      }) : [];
      // only print few words only
      this.outputChannel.info(
        `Relevant chunks: ${JSON.stringify(result.slice(0, 1))}`
      );

      let finalResult: Array<any> = [];
      data.referenceList?.forEach((element) => {
        let finalChunkInfos: Array<any> = [];
        element.chunks?.forEach((chunk) => {
          this.outputChannel.info(`chunk: ${JSON.stringify(result)}`);
          let selectedChunkInfo = result.find((res: any) => {
            return res.chunk_hash === chunk.chunk_hash;
          }
          );
          if (selectedChunkInfo) {
            finalChunkInfos.push(selectedChunkInfo.chunk_info);
          }
        });

        finalResult.push({
          "type": element.type,
          "value": element.value,
          "chunks": finalChunkInfos || null,
          "path": element.path
        });
      });

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
  private async _fetchRelevantHistory(currentSessionId: number, query: string): Promise<{ text?: string; ids: number[] }> {
    this.outputChannel.info(`Fetching relevant history for session ${currentSessionId} and query "${query.substring(0, 50)}..."`);
    try {
      const relevantHistoryData = await this.historyService.getRelevantChatHistory(currentSessionId, query);
      const relevantHistoryChats = relevantHistoryData?.chats || [];

      if (!relevantHistoryChats.length) {
        this.outputChannel.info("No relevant chat history found.");
        return { ids: [] };
      }

      let combinedText = "";
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
      this.outputChannel.error("Active repository is not defined.");
      return null;
    }

    const filePath = path.join(active_repo, ".deputydevrules");

    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf8");
      }
    } catch (error) {
      this.logger.error("Error reading .deputydevrules file");
      this.outputChannel.error("Error reading .deputydevrules file");
    }
    return null;
  }

  /**
   * apiChat:
   * Expects a payload that includes message_id along with the query with other parameters,
   * and uses the querySolver service to yield text chunks. Each chunk is sent via
   * the provided chunkCallback.
   */

  async apiChat(
    payload: ChatPayload,
    chunkCallback: ChunkCallback
  ) {
    const originalPayload = structuredClone(payload);
    const abortController = new AbortController();
    this.currentAbortController = abortController; // Track the current controller

    let querySolverTask: { abortController: AbortController; asyncIterator: AsyncIterableIterator<any> } | undefined;

    try {
      this.outputChannel.info("apiChat initiated.");
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
        const focus_chunks = await this.getFocusChunks(
          payload,
        );
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
      payload.os_name = osName();
      payload.shell = getShell();

      this.outputChannel.info("Payload prepared for QuerySolverService.");
      // console.log(payload)
      this.outputChannel.info(`Processed payload: ${JSON.stringify(payload)}`);


      // 2. Call Query Solver Service and Register Task for Cancellation
      const querySolverIterator = this.querySolverService.querySolver(payload, abortController.signal);
      querySolverTask = { abortController, asyncIterator: querySolverIterator };
      registerApiChatTask(querySolverTask);

      this.outputChannel.info("QuerySolverService called, listening for events...");



      let currentToolRequest: ToolRequest | null = null;
      let currentDiffRequest: any = null;

      for await (const event of querySolverIterator) {
        if (abortController.signal.aborted) {
          this.outputChannel.warn('apiChat aborted by cancellation signal.');
          break; // Exit loop if cancelled
        }

        // this.outputChannel.info(`Received event:`, JSON.stringify(event)); // Log event type


        switch (event.type) {
          case "RESPONSE_METADATA":
            if (event.content?.session_id) { // Set session ID if not already set
              setSessionId(event.content.session_id);
              this.outputChannel.info(`Session ID set: ${event.content.session_id}`);
            }
            chunkCallback({ name: event.type, data: event.content });
            break;

          case "TOOL_USE_REQUEST_START": {
            currentToolRequest = {
              tool_name: event.content.tool_name,
              tool_use_id: event.content.tool_use_id,
              accumulatedContent: "",
              write_mode: payload.write_mode,
            };
            // Immediately forward the start event.
            chunkCallback({ name: event.type, data: event.content });
            break;
          }
          case "TOOL_USE_REQUEST_DELTA": {
            if (currentToolRequest) {
              currentToolRequest.accumulatedContent +=
                event.content?.input_params_json_delta || "";
              // Forward the delta along with the tool_use_id.
              chunkCallback({
                name: event.type,
                data: {
                  tool_name: currentToolRequest.tool_name,
                  tool_use_id: currentToolRequest.tool_use_id,
                  delta: event.content?.input_params_json_delta || "",
                },
              });
            }
            break;
          }
          case "TOOL_USE_REQUEST_END": {
            if (currentToolRequest) {
              chunkCallback({
                name: event.type,
                data: {
                  tool_name: currentToolRequest.tool_name,
                  tool_use_id: currentToolRequest.tool_use_id,
                },
              });
              await this._runTool(currentToolRequest, messageId, chunkCallback);
              currentToolRequest = null;
            }
            break;
          }
          case "CODE_BLOCK_START":
            if (event.content?.is_diff) {
              currentDiffRequest = {
                filepath: event.content?.filepath,
                // raw_diff will be populated at CODE_BLOCK_END
              };
              this.outputChannel.info(`Starting diff block for: ${currentDiffRequest.filepath}`);
            }
            chunkCallback({ name: event.type, data: event.content });
            break;

          case "CODE_BLOCK_END": {
            this.outputChannel.info(
              `Code block end: ${JSON.stringify(event.content)}`
            );
            if (currentDiffRequest) {
              currentDiffRequest.raw_diff = event.content.diff;
              chunkCallback({ name: event.type, data: event.content });
              const active_repo = getActiveRepo();
              if (!active_repo) {
                throw new Error(
                  "Active repository is not defined. cannot apply diff"
                );
              }
              if (payload.write_mode) {
                // Usage tracking
                const usageTrackingData: UsageTrackingRequest = {
                  event: "generated",
                  properties: {
                    file_path: vscode.workspace.asRelativePath(
                      vscode.Uri.parse(currentDiffRequest.filepath)
                    ),
                    lines:
                      Math.abs(event.content.added_lines) +
                      Math.abs(event.content.removed_lines),
                    source: payload.is_inline ? "inline-chat-act" : "act",
                  },
                };
                const usageTrackingManager = new UsageTrackingManager();
                usageTrackingManager.trackUsage(usageTrackingData);
                const modifiedFiles =
                  await this.getModifiedRequest(currentDiffRequest);
                if (modifiedFiles) {
                  //  only log 1st words
                  this.outputChannel.error(
                    `the modified file at vscode side is:  ${JSON.stringify(
                      modifiedFiles
                    ).slice(0, 1)}`
                  );
                  this.sidebarProvider?.sendMessageToSidebar({
                    id: messageId,
                    command: "chunk",
                    data: {
                      name: "APPLY_DIFF_RESULT",
                      data: "completed",
                    },
                  });
                  await this.handleModifiedFiles(modifiedFiles, active_repo, getSessionId(), payload.write_mode, payload.is_inline);
                }
                else {
                  this.sidebarProvider?.sendMessageToSidebar({
                    id: messageId,
                    command: "chunk",
                    data: {
                      name: "APPLY_DIFF_RESULT",
                      data: "error",
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
      // Signal end of stream.
      chunkCallback({ name: "end", data: {} });
    } catch (error: any) {
      this.outputChannel.error(`Error during apiChat: ${error.message}`, error);
      this.onError(error);
      // Send error details back to the UI for potential retry
      chunkCallback({
        name: "error",
        data: {
          payload_to_retry: originalPayload,
          error_msg: String(error.message || error),
          retry: true // Suggest retry is possible
        }
      });
    } finally {
      // Cleanup: Unregister task and clear controller regardless of success/error/cancellation
      if (querySolverTask) {
        unregisterApiChatTask(querySolverTask);
      }
      this.currentAbortController = null;
      this.outputChannel.info("apiChat finished cleanup.");
    }
  }

  public async getModifiedRequest(
    currentDiffRequest: CurrentDiffRequest
  ): Promise<Record<string, string> | null> {
    this.outputChannel.info(
      `Running diff tool for file ${currentDiffRequest.filepath}`
    );

    const active_repo = getActiveRepo();
    if (!active_repo) {
      throw new Error("Active repository is not defined.");
    }

    // Parse accumulated diff content to extract necessary params
    const raw_udiff = currentDiffRequest.raw_diff;
    const payload_key = currentDiffRequest.filepath;

    this.outputChannel.info("getting modified file from binary");

    // Call the external function to fetch the modified file
    const result = await this.fetchModifiedFile(active_repo, {
      [payload_key]: raw_udiff,
    });


    if (!result || Object.keys(result).length === 0) {
      this.outputChannel.info(`no file update after search and replace`);
      // vscode.window.showErrorMessage(
      //   "No file updated after search and replace."
      // );
      return null;
    }
    this.outputChannel.info(`Modified file: ${JSON.stringify(result)}`);

    return result;
  }

  public async fetchModifiedFile(
    repo_path: string,
    file_path_to_diff_map: Record<string, string>
  ): Promise<any> {
    try {
      const authToken = await this.authService.loadAuthToken();
      const headers = {
        "Authorization": `Bearer ${authToken}`
      }
      const response = await binaryApi().post(API_ENDPOINTS.DIFF_APPLIER, {
        repo_path: repo_path,
        file_path_to_diff_map: file_path_to_diff_map,
      }, { headers });
      return response.status === 200 ? response.data : "failed";
    } catch (error) {
      this.logger.error("Error while applying diff");

      // console.log({
      //     repo_path: repo_path,
      //     file_path_to_diff_map: file_path_to_diff_map,
      // });
      // console.log(error)
      // console.error("Error while applying diff:", error);
      throw error;
    }
  }


  /**
     * Calls the backend API for batch chunk search (focused_snippets_searcher).
     */
  private async _fetchBatchChunksSearch(repoPath: string, searchTerms: SearchTerm[]): Promise<any> {
    this.outputChannel.info(`Calling batch chunks search API.`);
    try {
      const authToken = await this.authService.loadAuthToken();
      const headers = { "Authorization": `Bearer ${authToken}` };
      const response = await binaryApi().post(API_ENDPOINTS.BATCH_CHUNKS_SEARCH, {
        repo_path: repoPath,
        search_terms: searchTerms,
      }, { headers });

      if (response.status === 200) {
        this.outputChannel.info("Batch chunks search API call successful.");
        return response.data;
      } else {
        this.logger.error(`Batch chunks search API failed with status ${response.status}`);
        this.outputChannel.error(`Batch chunks search API failed with status ${response.status}`);
        throw new Error(`Batch chunks search failed with status ${response.status}`);
      }
    } catch (error: any) {
      this.logger.error(`Error calling batch chunks search API: ${error.message}`);
      this.outputChannel.error(`Error calling batch chunks search API: ${error.message}`, error);
      throw error;
    }
  }

  /**
    * Calls the backend API for file path search.
    */
  private async _fetchFilePathSearch(repoPath: string, directory: string, searchTerms?: string[]): Promise<any> {
    this.outputChannel.info(`Calling file path search API.`);
    try {
      const authToken = await this.authService.loadAuthToken();
      const headers = { "Authorization": `Bearer ${authToken}` };
      const response = await binaryApi().post(API_ENDPOINTS.FILE_PATH_SEARCH, {
        repo_path: repoPath,
        directory: directory,
        search_terms: searchTerms, // Send null/undefined if not provided
      }, { headers });

      if (response.status === 200) {
        this.outputChannel.info("File path search API call successful.");
        return response.data;
      } else {
        this.logger.error(`File path search API failed with status ${response.status}`);
        this.outputChannel.error(`File path search API failed with status ${response.status}`);
        throw new Error(`File path search failed with status ${response.status}`);
      }
    } catch (error: any) {
      this.logger.error(`Error calling file path search API: ${error.message}`);
      this.outputChannel.error(`Error calling file path search API: ${error.message}`, error);
      throw error;
    }
  }

  async _runIterativeFileReader(
    repoPath: string,
    filePath: string,
    startLine: number,
    endLine: number,
  ): Promise<any> {
    this.outputChannel.info(`Running iterative file reader for ${filePath}`);
    try {
      const authToken = await this.authService.loadAuthToken();
      const headers = { "Authorization": `Bearer ${authToken}` };
      const response = await binaryApi().post(API_ENDPOINTS.ITERATIVELY_READ_FILE, {
        repo_path: repoPath,
        file_path: filePath,
        start_line: startLine,
        end_line: endLine,
      }, { headers });

      if (response.status === 200) {
        this.outputChannel.info("Iterative file reader API call successful.");
        return response.data;
      } else {
        this.logger.error(`Iterative file reader API failed with status ${response.status}`);
        this.outputChannel.error(`Iterative file reader API failed with status ${response.status}`);
        throw new Error(`Iterative file reader failed with status ${response.status}`);
      }
    } catch (error: any) {
      this.logger.error(`Error calling Iterative file reader API: ${error.message}`);
      this.outputChannel.error(`Error calling Iterative file reader API: ${error.message}`, error);
      throw error;
    }
  }

  async _runGrepSearch(
    directoryPath: string,
    repoPath: string,
    searchTerms?: string[],
  ): Promise<any> {
    this.outputChannel.info(`Running grep search tool for ${directoryPath}`);
    try {
      const authToken = await this.authService.loadAuthToken();
      const headers = { "Authorization": `Bearer ${authToken}` };
      const response = await binaryApi().post(API_ENDPOINTS.GREP_SEARCH, {
        repo_path: repoPath,
        directory_path: directoryPath,
        search_terms: searchTerms
      }, { headers });

      if (response.status === 200) {
        this.outputChannel.info("Grep search API call successful.");
        this.outputChannel.info(`Grep search result: ${JSON.stringify(response.data)}`);
        return response.data;
      } else {
        this.logger.error(`Grep search API failed with status ${response.status}`);
        this.outputChannel.error(`Grep search API failed with status ${response.status}`);
        throw new Error(`Grep search API failed with status ${response.status}`);
      }
    } catch (error: any) {
      this.logger.error(`Error calling Grep search API: ${error.message}`);
      this.outputChannel.error(`Error calling Grep search API: ${error.message}`, error);
      throw error;
    }
  }



  async _runCreateNewWorkspace(
    active_repo: string,
    query: string,
  ): Promise<void> {
    
  }


    
  async _runExecuteCommand(
    command: string,
    requires_approval: boolean,
    chunkCallback: ChunkCallback,
    toolRequest: ToolRequest,
    messageId?: string,
  ): Promise<any> {
    if (!command) {
      throw new Error("Command is empty.");
    }
  
    const parsedContent = JSON.parse(toolRequest.accumulatedContent);
    const isInDenyList =  true;
  
    this.outputChannel.info(`Running execute command: ${command}`);
    this.outputChannel.info(`Approval required for command: ${requires_approval}`);
  
    if (requires_approval || isInDenyList) {
      // Step 1: Request approval
      chunkCallback({
        name: "TERMINAL_APPROVAL",
        data: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          terminal_approval_required: true,
        },
      });
  
      
      // 2) wait for the matching approval event
      await new Promise<void>(resolve => {
        const disposable = this.onTerminalApprove(({ toolUseId }) => {
          if (toolUseId === toolRequest.tool_use_id) {
            disposable.dispose();
            resolve();
          }
        });
      });
    }
    // console.log(`Command ${command} approved or not needed.`);
  
    // Step 2: Actually execute the command (if approved or not needed)
    try {
      const activeRepo = getActiveRepo();
      if (!activeRepo) {
        throw new Error(`Command failed: Active repository is not defined.`);
      }
        this.outputChannel.info(`now running terminal manager: ,  ${activeRepo}`);
        const terminalInfo = await this.terminalManager.getOrCreateTerminal(activeRepo);
        terminalInfo.terminal.show();
        const process = this.terminalManager.runCommand(terminalInfo, command);
        process.on('line', (line) => {
          this.outputChannel.info(`Terminal output: ${line}`);
      });
        await process;
        const output = this.terminalManager.getUnretrievedOutput(terminalInfo.id);
        this.outputChannel.info(`Terminal command executed: ${terminalInfo.id}`);
        return output;
    } catch (err: any) {
      this.logger.error(`Command execution failed: ${err.message}`);
      throw new Error(`Command failed: ${err.message}`);
    }
  }
  
  async _runTerminalCommand (command: string): Promise<any> {
  }
  




  async handleModifiedFiles(
    modifiedFiles: Record<string, string>,
    active_repo: string,
    session_id?: number,
    write_mode?: boolean,
    is_inline?: boolean,
    is_inline_modify?: boolean
  ): Promise<void> {
    for (const [relative_path, content] of Object.entries(modifiedFiles)) {
      const fullPath = join(active_repo, relative_path);
      await this.diffViewManager.openDiffView({ path: fullPath, content }, session_id, write_mode, is_inline, is_inline_modify);
    }
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

  private async _runTool(toolRequest: ToolRequest, messageId: string | undefined, chunkCallback: ChunkCallback): Promise<void> {
    this.outputChannel.info(`Running tool: ${toolRequest.tool_name} (ID: ${toolRequest.tool_use_id})`);

    let rawResult: any;
    let status: "completed" | "error" = "error"; // Default to error
    let resultForUI: any; // This will hold what's sent in TOOL_USE_RESULT
    if (toolRequest.tool_name == "create_new_workspace") {
      this.outputChannel.info(`Running create_new_workspace tool`);
      return;
    }
    try {
      const active_repo = getActiveRepo();
      if (!active_repo) {
        throw new Error("Active repository is not defined for running tool.");
      }

      let parsedContent: any;
      try {
        parsedContent = JSON.parse(toolRequest.accumulatedContent);
        this.outputChannel.info(`Parsed tool parameters: ${JSON.stringify(parsedContent)}`);
      } catch (parseError: any) {
        this.logger.error(`Failed to parse tool parameters JSON: ${parseError.message}`);
        throw new Error(`Failed to parse tool parameters JSON: ${parseError.message}`);
      }

      // Execute the specific tool function
      switch (toolRequest.tool_name) {
        case "related_code_searcher":
          rawResult = await this._runRelatedCodeSearcher(active_repo, parsedContent);
          break;
        case "focused_snippets_searcher":
          rawResult = await this._runFocusedSnippetsSearcher(active_repo, parsedContent);
          break;
        case "file_path_searcher":
          this.outputChannel.info(`Running file_path_searcher with params: ${JSON.stringify(parsedContent)}`);
          rawResult = await this._runFilePathSearcher(active_repo, parsedContent);
          break;
        case "iterative_file_reader":
          this.outputChannel.info(`Running iterative_file_reader with params: ${JSON.stringify(parsedContent)}`);
          rawResult = await this._runIterativeFileReader(active_repo, parsedContent.file_path, parsedContent.start_line, parsedContent.end_line);
          break;
        case "grep_search":
          this.outputChannel.info(`Running grep_search with params: ${JSON.stringify(parsedContent)}`);
          rawResult = await this._runGrepSearch(parsedContent.directory_path, active_repo, parsedContent.search_terms)
          break;
        case "execute_command":
          this.outputChannel.info(`Running execute_command with params: ${JSON.stringify(parsedContent)}`);
          rawResult = await this._runExecuteCommand(parsedContent.command , parsedContent.requires_approval , chunkCallback , toolRequest , messageId || "" );
        break;
        default:
          this.outputChannel.warn(`Unknown tool requested: ${toolRequest.tool_name}`);
          // Treat as completed but with a message indicating it's unknown
          rawResult = { message: `Tool '${toolRequest.tool_name}' is not implemented.` };
          // We will still send TOOL_USE_RESULT, but won't recurse apiChat
          status = "completed";
          resultForUI = rawResult; // Send the message back
          // Send TOOL_USE_RESULT immediately as no continuation payload needed
          chunkCallback({
            name: "TOOL_USE_RESULT",
            data: {
              tool_name: toolRequest.tool_name,
              tool_use_id: toolRequest.tool_use_id,
              result_json: resultForUI,
              status: status,
            },
          });
          return; // Exit _runTool early for unknown tools
      }

      // Check if the tool function executed successfully and returned a valid result
      // (null/undefined might indicate an internal tool error not caught)
      status = "completed";
      resultForUI = rawResult; // The raw result is usually what the UI might want to display
      this.outputChannel.info(`Tool ${toolRequest.tool_name} completed successfully.`);

      // Prepare payload to continue chat with the tool's response
      const structuredResponse = this._structureToolResponse(toolRequest.tool_name, rawResult);
      const continuationPayload: ChatPayload = {
        message_id: messageId, // Pass original message ID for context if needed by UI later
        write_mode: toolRequest.write_mode,
        is_tool_response: true,
        tool_use_response: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          response: structuredResponse, // Use the structured response for the backend
        },
        os_name : osName(),
        shell : getShell()
        // TODO: Consider if previous_query_ids need to be passed down through tool calls
      };

      // *** CRITICAL STEP ***
      // Send TOOL_USE_RESULT *before* awaiting the recursive apiChat call.
      // This ensures the UI knows this tool finished before the next phase starts.
      chunkCallback({
        name: "TOOL_USE_RESULT",
        data: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          result_json: resultForUI, // Send the raw result to UI
          status: status,
        },
      });

      // Now, continue the chat flow with the tool response
      this.outputChannel.info(`Continuing chat after ${toolRequest.tool_name} result.`);
      await this.apiChat(continuationPayload, chunkCallback);


    } catch (error: any) {
      this.logger.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`);
      this.outputChannel.error(`Error running tool ${toolRequest.tool_name}: ${error.message}`, error);
      this.onError(error);
      status = "error";
      resultForUI = { error: error.message }; // Set result to error message for UI

      // Send error result back to UI
      // No recursive apiChat call should happen on error.
      chunkCallback({
        name: "TOOL_USE_RESULT",
        data: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          result_json: resultForUI,
          status: status,
        },
      });
      // Do NOT continue chat if the tool itself failed critically
      const toolUseRetryPayload = {
        message_id: messageId, // Pass original message ID for context if needed by UI later
        write_mode: toolRequest.write_mode,
        is_tool_response: true,
        tool_use_failed: true,
        tool_use_response: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          response: {
            "message": "Tool use failed, you might want to retry",
            "error_message": error.message
          },
        },
        os_name : osName(),
        shell : getShell()
        
      }
      await this.apiChat(toolUseRetryPayload, chunkCallback);
    }
  }


  /**
  * Structures the raw tool result into the format expected by the backend's tool_use_response.
  */
  private _structureToolResponse(toolName: string, rawResult: any): any {
    switch (toolName) {
      case "related_code_searcher":
        return { RELEVANT_CHUNKS: rawResult };
      case "focused_snippets_searcher":
        return { batch_chunks_search: rawResult };
      case "file_path_searcher":
        return { file_path_search: rawResult };
      case "iterative_file_reader":
        return { iterative_file_reader_result: rawResult };
      case "grep_search":
        return { grep_search_result: rawResult };
      case "execute_command":
        return { execute_command_result: rawResult };
      default:
        // For unknown or simple tools, return the result directly (though handled earlier now)
        return rawResult;
    }
  }


  // --- Specific Tool Implementations ---

  private async _runRelatedCodeSearcher(repoPath: string, params: { search_query?: string; paths?: string[] }): Promise<any> {
    const query = params.search_query || "";
    // const focusFiles = params.paths || []; // Currently unused based on original code?
    const currentSessionId = getSessionId();

    if (!currentSessionId) {
      throw new Error("Session ID is required for related_code_searcher");
    }
    this.outputChannel.info(`Executing related_code_searcher: query="${query.substring(0, 50)}..."`);

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

  private async _runFilePathSearcher(repoPath: string, params: { directory?: string; search_terms?: string[] }): Promise<any> {

    const directory = params.directory;
    const searchTerms = params.search_terms; // Optional
    this.outputChannel.info(`Executing file_path_searcher: directory="${directory}", terms="${searchTerms?.join(', ')}"`);
    // return this._fetchFilePathSearch(repoPath, directory || "", searchTerms);
    return this._fetchFilePathSearch(repoPath, directory || "", searchTerms);
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
}
