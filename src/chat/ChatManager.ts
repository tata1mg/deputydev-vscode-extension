// import * as path from 'node:path';
import { join } from 'path';
import * as vscode from 'vscode';
import { DiffViewManager } from '../diff/DiffManager';
import { SidebarProvider } from '../panels/SidebarProvider';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { QuerySolverService } from "../services/chat/ChatService";
import { fetchRelevantChunks } from "../clients/common/websocketHandlers";
import { getActiveRepo, getSessionId, setQueryId, setSessionId } from '../utilities/contextManager';

interface payload {
  focus_files?: string[];
  focus_chunks?: string[];
  message_id?: string;
  query?: string;
  is_tool_response?: boolean;
  relevant_chunks?: any[];
  write_mode?: boolean;
  referenceList?: string[];
  tool_use_response?: {
    tool_name: string;
    tool_use_id?: string;
    response: any;
  };
}

interface SearchTerm {
  keyword: string;
  type: string;
}

interface ToolRequest {
  tool_name: string;
  tool_use_id: string;
  accumulatedContent: string;
  write_mode? : boolean;
}


interface CurrentDiffRequest {
  filepath: string;
  raw_diff: string;

}


export class ChatManager {
  private querySolverService = new QuerySolverService();
  private sidebarProvider?: SidebarProvider; // Optional at first



  onStarted: () => void = () => { };
  onError: (error: Error) => void = () => { };
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
    private diffViewManager: DiffViewManager,

  ) { }


  // Method to set the sidebar provider later
  setSidebarProvider(sidebarProvider: SidebarProvider) {
    this.sidebarProvider = sidebarProvider;
  }

  async start() {
    this.outputChannel.info('Starting deputydev binary service...');

    // const config = vscode.workspace.getConfiguration('deputydev');
    // const pythonPath = config.get('pythonPath') as string;
    // if (!pythonPath) {
    //   this.outputChannel.info('Python path is not set, skip starting deputydev binaray service.');
    //   vscode.window.showErrorMessage('Python path is not set, please set it in vscode settings.');
    //   return Promise.reject();
    // }

    // // Determine if the given path is a file or a directory.
    // let pythonPathFile: string;
    // try {
    //   const stats = await fsPromise.stat(pythonPath);
    //   pythonPathFile = stats.isFile() ? pythonPath : path.join(pythonPath, 'python');
    // } catch (error) {
    //   this.outputChannel.error('Error accessing python path');
    //   vscode.window.showErrorMessage('Invalid python path.');
    //   return Promise.reject();
    // }

    // if (!pythonPathFile) {
    //   this.outputChannel.error('Python path does not include python executable, skip starting hat service.');
    //   vscode.window.showErrorMessage('Python path does not include python executable, please set it in vscode settings.');
    //   return Promise.reject();
    // }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      // this.outputChannel.warn('No workspace folders found, skip starting chat service.');
      // vscode.window.showWarningMessage('No workspace folders found, skip starting chat service.');
      return Promise.reject();
    }

    if (folders.length > 1) {
      // this.outputChannel.warn('Multiple workspace folders found, skip starting chat service.');
      // vscode.window.showWarningMessage('Current only supports a single workspace folder.');
      return Promise.reject();
    }
    // Additional initialization logic can be added here.
  }

  restart() {
    this.outputChannel.info('Restarting deputydev binary service...');
    this.stop();
    this.start();
  }

  stop() {
    this.outputChannel.info('Stopping deputydev binary service...');
  }




  async processRelevantChunks(data: payload): Promise<string[]> {
    try {
      // If data contains a referenceList, process it as needed.
      // if (data.referenceList) {
      //   // TODO: Create an array from the referenceList and process it if necessary.
      // }


      // Retrieve the active repository path.
      const active_repo = getActiveRepo();
      if (!active_repo) {
        throw new Error('Active repository is not defined.');
      }
      // Extract the query from the data.
      const query = data.query || '';
      this.outputChannel.info(`Relevant chunks next`);

      // Call the external function to fetch relevant chunks.
      const result = await fetchRelevantChunks({
        repo_path: active_repo,
        query: query,
        // focus_chunks: data.focus_chunks || [],
        // focus_files: data.focus_files || [],
      });
      // only print few words only
      this.outputChannel.info(`Relevant chunks: ${JSON.stringify(result.slice(0, 1))}`);
      // Extract the content from each chunk in the payload.
      return result;


    } catch (error) {
      this.outputChannel.error(`Error fetching relevant chunks: ${error}`);
      return [];
    }
  }


    /**
   * apiChat:
   * Expects a payload that includes message_id along with the query with other parameters,
   * and uses the querySolver service to yield text chunks. Each chunk is sent via
   * the provided chunkCallback.
   */


  async apiChat(payload: payload, chunkCallback: (data: { name: string; data: unknown }) => void) {
    try {
      this.outputChannel.info(`apiChat payload: ${JSON.stringify(payload)}`);

      if (payload.query) {
        const relevant_chunks = await this.processRelevantChunks(payload);
        payload.relevant_chunks = relevant_chunks;
      }
      delete payload.referenceList;

      let message_id = undefined;

      if (payload.message_id) {
        this.outputChannel.info(`Message ID: ${payload.message_id}`);
        message_id = payload.message_id;
        delete payload.message_id;
      }

      if (payload.is_tool_response) {
        delete payload.query;
      }
      delete payload.is_tool_response;



      const querySolverIterator = await this.querySolverService.querySolver(payload);
      let currentToolRequest: any = null;
      let currentDiffRequest: any = null;

      for await (const event of querySolverIterator) {
        switch (event.type) {
          case 'RESPONSE_METADATA': {
            if (event.content?.session_id) {
              setSessionId(event.content.session_id);
            }
            if (event.content?.query_id) {
              setQueryId(event.content.session_id);
            }
            const sessionid = getSessionId()
            this.outputChannel.info(`Session ID: ${sessionid}`);
            chunkCallback({ name: event.type, data: event.content });
            break;
          }
          case 'TOOL_USE_REQUEST_START': {
            currentToolRequest = {
              tool_name: event.content?.tool_name,
              tool_use_id: event.content?.tool_use_id,
              accumulatedContent: '',
              write_mode : payload.write_mode
            };
            // Immediately forward the start event.
            chunkCallback({ name: event.type, data: event.content });
            break;
          }
          case 'TOOL_USE_REQUEST_DELTA': {
            if (currentToolRequest) {
              currentToolRequest.accumulatedContent += event.content?.input_params_json_delta || '';
              // Forward the delta along with the tool_use_id.
              chunkCallback({
                name: event.type,
                data: {
                  tool_name: currentToolRequest.tool_name,
                  tool_use_id: currentToolRequest.tool_use_id,
                  delta: event.content?.input_params_json_delta || '',
                },
              });
            }
            break;
          }
          case 'TOOL_USE_REQUEST_END': {
            if (currentToolRequest) {
              chunkCallback({
                name: event.type,
                data: {
                  tool_name: currentToolRequest.tool_name,
                  tool_use_id: currentToolRequest.tool_use_id,
                },
              });
              // Run the tool (placeholder) and send a result.
              await this.runTool(currentToolRequest, message_id);

              currentToolRequest = null;
            }
            break;
          }
          case 'CODE_BLOCK_START': {
            if (event.content?.is_diff) {
              currentDiffRequest = {
                is_diff: true,
                filepath: event.content?.filepath,
                language: event.content?.language,
              };
            }
            chunkCallback({ name: event.type, data: event.content });
            break;
          }


          case 'CODE_BLOCK_END': {
            this.outputChannel.info(`Code block end: ${JSON.stringify(event.content)}`);
            if (currentDiffRequest) {
              currentDiffRequest.raw_diff = event.content.diff;
              chunkCallback({ name: event.type, data: event.content });
              const active_repo = getActiveRepo();
              if (!active_repo) {
                throw new Error('Active repository is not defined. cannot apply diff');
              }
              if (payload.write_mode) {
                const modifiedFiles = await this.getModifiedRequest(currentDiffRequest);
                await this.handleModifiedFiles(modifiedFiles, active_repo);
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
      chunkCallback({ name: 'end', data: {} });

    } catch (error) {
      this.outputChannel.error(`Error during apiChat: ${error}`);
    }
  }


  public async getModifiedRequest(currentDiffRequest: CurrentDiffRequest) : Promise<Record<string, string>> {
    this.outputChannel.info(`Running diff tool for file ${currentDiffRequest.filepath}`);

    const active_repo = getActiveRepo();
    if (!active_repo) {
      throw new Error('Active repository is not defined.');
    }

    // Parse accumulated diff content to extract necessary params
    const raw_udiff = currentDiffRequest.raw_diff;
    const payload_key = currentDiffRequest.filepath;

    this.outputChannel.info("getting modified file from binary");

    // Call the external function to fetch the modified file
    const result = await this.fetchModifiedFile(
      active_repo,
      {
        [payload_key]: raw_udiff,
      }
    );

    console.log("result of binary search and replace", result);

    if (!result) {
      this.outputChannel.info(`no file update after search and replace`);
      return {};
    }
    this.outputChannel.info(`Modified file: ${JSON.stringify(result)}`);

    return result;
  }


  public async fetchModifiedFile(
    repo_path: string,
    file_path_to_diff_map: Record<string, string>,
  ): Promise<any> {
    try {
      const response = await binaryApi.post(
        API_ENDPOINTS.DIFF_APPLIER,
        {
          repo_path: repo_path,
          file_path_to_diff_map: file_path_to_diff_map,
        },

      );

      return response.status === 200 ? response.data : "failed";
    } catch (error) {
      console.error("Error while applying diff:", error);
      throw error;
    }
  }


  async handleModifiedFiles(
    modifiedFiles: Record<string, string>,
    active_repo: string
  ): Promise<void> {
    for (const [relative_path, content] of Object.entries(modifiedFiles)) {
      const fullPath = join(active_repo, relative_path);


      // // Check if file exists
      // if (!existsSync(fullPath)) {
      //   // Ensure parent directories exist
      //   const fs = await import('fs/promises');
      //   await fs.mkdir(join(fullPath, '..'), { recursive: true });

      //   // Create a new file with the provided content
      //   writeFileSync(fullPath, content);
      // } else {
      //   // File exists, update it with the new content
      //   writeFileSync(fullPath, content);
      // }

      await this.diffViewManager.openDiffView({ path : fullPath, content });
    }
  }

  async fetchFocusedSnippetsSearcherResult(repo_path: string, search_terms: SearchTerm[]): Promise<any> {
    try {
      const response = await binaryApi.post(
        API_ENDPOINTS.BATCH_CHUNKS_SEARCH,
        {
          repo_path: repo_path,
          search_terms: search_terms,
        },
      )
      return response.status === 200 ? response.data : "failed";
    } catch (error) {
      console.error("Error while fetching focused snippets searcher results:", error);
      throw error;
    }
  }

  async runTool(toolRequest: ToolRequest, message_id: string | undefined) {
    this.outputChannel.info(`Running tool ${toolRequest.tool_name} with id ${toolRequest.tool_use_id}`);
    this.outputChannel.info(`message id ${message_id}`);
    let active_repo;
    let parsedContent;
    let searchQuery: string;
    let focusFiles: string[];

    // Define the callback to send chunk data.
    const chunkCallback = (chunkData: unknown) => {
      this.sidebarProvider?.sendMessageToSidebar({
        // Use the same ID so that the front-end resolver knows which generator to push data into.
        id: message_id,
        command: 'chunk',
        data: chunkData,
      });
    };

    switch (toolRequest.tool_name) {
      case 'related_code_searcher':
        this.outputChannel.info("The tool use request:", JSON.stringify(toolRequest));
        active_repo = this.context.workspaceState.get<string>('activeRepo');
        if (!active_repo) {
          throw new Error('Active repository is not defined.');
        }

        // Parse accumulatedContent to extract the search query and paths (used as focus_files).
        parsedContent = JSON.parse(toolRequest.accumulatedContent);
        this.outputChannel.info(`Parsed Content: ${JSON.stringify(parsedContent, null, 2)}`);
        searchQuery = parsedContent.search_query || '';
        focusFiles = parsedContent.paths || [];

        this.outputChannel.info("Running related_code_searcher tool with query");
        // Call the external function to fetch relevant chunks.
        const result = await fetchRelevantChunks({
          repo_path: active_repo,
          query: searchQuery,
          // Uncomment and use focusFiles if needed:
          // focus_files: focusFiles,
        });

        if (result) {
          const payloadData = {
            message_id: message_id,
            write_mode : toolRequest.write_mode,
            tool_use_response: {
              tool_name: toolRequest.tool_name,
              tool_use_id: toolRequest.tool_use_id,
              response: {
                RELEVANT_CHUNKS: result
              }
            }
          };


          chunkCallback({
            name: 'TOOL_USE_RESULT',
            data: {
              tool_name: toolRequest.tool_name,
              tool_use_id: toolRequest.tool_use_id,
              result_json: result,
              status: 'completed',
            },
          });



          this.outputChannel.info(`Code searcher payload: ${JSON.stringify(payloadData)}`);
          await this.apiChat(payloadData, chunkCallback);
          return JSON.stringify({ completed: true });
        }

        this.outputChannel.info(`Code searcher result: ${JSON.stringify(result)}`);

        return JSON.stringify({ completed: false });

      case "focused_snippets_searcher":
        this.outputChannel.info("The tool use request:", JSON.stringify(toolRequest));
        active_repo = this.context.workspaceState.get<string>('activeRepo');
        if (!active_repo) {
          throw new Error('Active repository is not defined.');
        }

        // Parse accumulatedContent to extract the search query and paths (used as focus_files).
        parsedContent = JSON.parse(toolRequest.accumulatedContent);
        const search_terms = parsedContent.search_terms;

        this.outputChannel.info("Running focused_snippets_searcher tool with query");

        // const response = await this.fetchFocusedSnippetsSearcherResult(active_repo, search_terms);
        const response = ["This tool is not usable please related_code_searcher"]
        if (response) {
          const payloadData = {
            message_id: message_id,
            write_mode : toolRequest.write_mode,
            tool_use_response: {
              tool_name: toolRequest.tool_name,
              tool_use_id: toolRequest.tool_use_id,
              response: {
                batch_chunks_search: response
              }
            }
          }

          chunkCallback({
            name: 'TOOL_USE_RESULT',
            data: {
              tool_name: toolRequest.tool_name,
              tool_use_id: toolRequest.tool_use_id,
              result_json: response,
              status: 'completed',
            },
          });

          this.outputChannel.info(`Code searcher payload: ${JSON.stringify(payloadData)}`);
          await this.apiChat(payloadData, chunkCallback);
          return JSON.stringify({ completed: true });

        }

        this.outputChannel.info(`Focused snippets searcher result: ${JSON.stringify(response)}`);

        return JSON.stringify({ completed: false });

      default:
        this.outputChannel.warn(`Unknown tool: ${toolRequest.tool_name}`);
        return JSON.stringify({ completed: true });
    }
  }

  async apiClearChat() {
    // Implementation for clearing chat on the backend.
  }

  async apiSaveSession() {
    // Implementation for saving the chat session.
  }

  async apiChatSetting() {
    // Implementation for updating chat settings.
  }
}
