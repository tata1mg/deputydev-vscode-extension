import { spawn, ChildProcess } from 'node:child_process';
import * as fsPromise from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as vscode from 'vscode';
import { fetchRelevantChunks, updateVectorStore } from "../services/websockets/websocketHandlers";
import { QuerySolverService } from "../services/chat/ChatService"; 

// Define the expected payload interface for an API chat request.
export interface ChatApiPayload {
  session_id: string;
  message_id: string;
  query: string;
  relevant_chunks: string[];
  chat_type: 'ask' | 'write';
}

export class ChatManager {
  private querySolverService = new QuerySolverService();
  private aiderChatProcess: ChildProcess | undefined;
  private isDev = false;

  onStarted: () => void = () => { };
  onError: (error: Error) => void = () => { };

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) { }

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
  async apiChat(
    payload: ChatApiPayload,
    chunkCallback: (data: { name?: string; data: unknown }) => void,
  ) {
    try {
      this.outputChannel.info(
        `Starting chat session. Session ID: ${payload.session_id}, Message ID: ${payload.message_id}`
      );
      const querySolverIterator = await this.querySolverService.querySolver(payload);
      for await (const event of querySolverIterator) {
        chunkCallback({ name: 'data', data: { chunk: event.content } });
      }
      // Signal end of stream
      chunkCallback({ name: 'end', data: {} });
    } catch (error: unknown) {
      this.outputChannel.error(`Error in apiChat: ${error}`);
      const errorMessage = error instanceof Error ? error.message : String(error);
      chunkCallback({ name: 'error', data: { error: errorMessage } });
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
