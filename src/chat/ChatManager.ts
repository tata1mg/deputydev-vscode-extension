import { spawn, ChildProcess } from 'node:child_process';
import * as fsPromise from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as vscode from 'vscode';
import { fetchRelevantChunks, updateVectorStore } from "../services/websockets/websocketHandlers";
import { QuerySolverService } from "../services/chat/ChatService";
import { setSessionId , getSessionId  , setQueryId, getQueryId, deleteQueryId} from '../utilities/contextManager';
import { SidebarProvider } from '../panels/SidebarProvider';
interface payload {
  message_id?: string;
  query?: string;
  relevant_chunks?: string[];
  write_mode?: boolean;
  referenceList?: string[];
  tool_use_response ?: {
    tool_name: string;
    tool_use_id?: string;
    response: any;
  };
}

interface ToolRequest {
  tool_name?: string;
  tool_use_id?: string;
  accumulatedContent: string;
}


export class ChatManager {
  private querySolverService = new QuerySolverService();
  private aiderChatProcess: ChildProcess | undefined;
  private sidebarProvider?: SidebarProvider; // Optional at first

  private isDev = false;

  onStarted: () => void = () => { };
  onError: (error: Error) => void = () => { };
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
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
    //   this.outputChannel.error('Python path does not include python executable, skip starting aider-chat service.');
    //   vscode.window.showErrorMessage('Python path does not include python executable, please set it in vscode settings.');
    //   return Promise.reject();
    // }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      // this.outputChannel.warn('No workspace folders found, skip starting aider-chat service.');
      // vscode.window.showWarningMessage('No workspace folders found, skip starting aider-chat service.');
      return Promise.reject();
    }

    if (folders.length > 1) {
      // this.outputChannel.warn('Multiple workspace folders found, skip starting aider-chat service.');
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
    this.aiderChatProcess?.kill();
    this.aiderChatProcess = undefined;
  }

  /**
   * apiChat:
   * Expects a payload that includes session_id and message_id along with the query,
   * and uses the querySolver service to yield text chunks. Each chunk is sent via
   * the provided chunkCallback.
   */


  private async processRelevantChunks(data: payload): Promise<string[]> {
    try {
      // If data contains a referenceList, process it as needed.
      // if (data.referenceList) {
      //   // TODO: Create an array from the referenceList and process it if necessary.
      // }


      // Retrieve the active repository path.
      const active_repo = this.context.workspaceState.get<string>('activeRepo');
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

  async apiChat(payload: payload,  chunkCallback: (data: { name: string; data: unknown }) => void) {
    try {
      this.outputChannel.info(`apiChat payload: ${JSON.stringify(payload)}`);
      if (payload.query) {
        const relevant_chunks = await this.processRelevantChunks(payload);
        payload.relevant_chunks = relevant_chunks;
      }
      let message_id = undefined;

      if (payload.message_id) {
        this.outputChannel.info(`Message ID: ${payload.message_id}`);
        message_id = payload.message_id;
        delete payload.message_id;
      }


      const querySolverIterator = await this.querySolverService.querySolver(payload);
      let currentToolRequest: any = null;
      
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
              const toolResult =  await this.runTool(currentToolRequest, message_id);
              chunkCallback({
                name: 'TOOL_USE_RESULT',
                data: {
                  tool_name: currentToolRequest.tool_name,
                  tool_use_id: currentToolRequest.tool_use_id,
                  result_json: toolResult,
                  status: 'completed',
                },
              });
              currentToolRequest = null;
            }
            break;
          }
          default:
            // Forward all other events unchanged.
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


  

   async runTool(toolRequest: ToolRequest, message_id: string | undefined) {
    this.outputChannel.info(`Running tool ${toolRequest.tool_name} with id ${toolRequest.tool_use_id}`);
    this.outputChannel.info(`message id ${message_id}`);
    switch (toolRequest.tool_name) {
      case 'code_searcher':
        this.outputChannel.info("The tool use request:", JSON.stringify(toolRequest));
      const active_repo = this.context.workspaceState.get<string>('activeRepo');
      if (!active_repo) {
        throw new Error('Active repository is not defined.');
      }
      
      // Parse accumulatedContent to extract the search query and paths (used as focus_files).
      const parsedContent = JSON.parse(toolRequest.accumulatedContent);
      const searchQuery: string = parsedContent.search_query || '';
      const focusFiles: string[] = parsedContent.paths || [];
  
      this.outputChannel.info("Running code_searcher tool with query");
      // Call the external function to fetch relevant chunks.
      const result = await fetchRelevantChunks({
        repo_path: active_repo,
        query: searchQuery,
        // Uncomment and use focusFiles if needed:
        // focus_files: focusFiles,
      });
  
      // Define the callback to send chunk data.
      const chunkCallback = (chunkData: unknown) => {
        this.sidebarProvider?.sendMessageToSidebar({
          // Use the same ID so that the front-end resolver knows which generator to push data into.
          id: message_id,
          command: 'chunk',
          data: chunkData,
        });
      };
  
      if (result) {
        const payloadData = {
          message_id: message_id,
          tool_use_response: {
            tool_name: toolRequest.tool_name,
            tool_use_id: toolRequest.tool_use_id,
            response: {
              RELEVANT_CHUNKS: result
            }
          }
        };

        this.outputChannel.info(`Code searcher payload: ${JSON.stringify(payloadData)}`);
        await this.apiChat(payloadData, chunkCallback);
        return JSON.stringify({ result: 'Completed Tool use ' });
      }
  
      this.outputChannel.info(`Code searcher result: ${JSON.stringify(result)}`);
  
      return JSON.stringify({ result: 'Tool Failed' });

      case 'ask_user_input':
        return JSON.stringify({ result: 'User input requested' });
        
      default:
        this.outputChannel.warn(`Unknown tool: ${toolRequest.tool_name}`);
        return JSON.stringify({ placeholder: true });
    }
  }



  async apiClearChat() {
    // Implementation for clearing chat on the backend.
  }

  async apiSaveSession(payload: unknown) {
    // Implementation for saving the chat session.
  }

  async apiChatSetting(payload: unknown) {
    // Implementation for updating chat settings.
  }
}
