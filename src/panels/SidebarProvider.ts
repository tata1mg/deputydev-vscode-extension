
import * as path from "path";
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { AuthenticationManager } from '../auth/AuthenticationManager';
import { ChatManager } from '../chat/ChatManager';
import { DiffViewManager } from '../diff/DiffManager';
import { getUri } from '../utilities/getUri';
import { requireModule } from '../utilities/require-config';
import { WorkspaceManager } from '../embedding/WorkspaceManager';
import { HistoryService } from "../services/history/HistoryService";
export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private pendingMessages: any[] = []
  private _onDidChangeRepo = new vscode.EventEmitter<string | undefined>();
  public readonly onDidChangeRepo = this._onDidChangeRepo.event;
  private _onWebviewFocused = new vscode.EventEmitter<void>();
  public readonly onWebviewFocused = this._onWebviewFocused.event;
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly _extensionUri: vscode.Uri,
    private readonly diffViewManager: DiffViewManager,
    private readonly outputChannel: vscode.LogOutputChannel,
    private chatService: ChatManager,
    private historyService: HistoryService,
  ) { }


  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context?: vscode.WebviewViewResolveContext,
    _token?: vscode.CancellationToken,
    
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    // Flush any pending messages now that the view is initialized
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      this._view.webview.postMessage(message);
    }

    // Listen for messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      let promise: Promise<any> | any;
      const command = message.command;
      const data = message.data;
      // Define the expected structure for the chunk callback
      interface ChunkType {
        name?: string;
        data: { chunk: string };
      }

      const chunkCallback = (chunkData: unknown) => {
        this.sendMessageToSidebar({
          // Use the same ID so that the front-end resolver knows which generator to push data into.
          id: message.id,
          command: 'chunk',
          data: chunkData,
        });
      };
      // Depending on `command`, handle each case
      switch (command) {
        case 'api-chat':
          console.log('api-chat data:', data);
          promise = this.chatService.apiChat(data, chunkCallback);
          break;

        case 'api-clear-chat':
          promise = this.chatService.apiClearChat();
          break;
        case 'api-save-session':
          promise = this.chatService.apiSaveSession(data);
          break;
        case 'api-chat-setting':
          promise = this.chatService.apiChatSetting(data);
          break;
        


        // File Operations
        case 'accept-file':
          promise = this.acceptFile(data.path);
          break;
        case 'reject-file':
          promise = this.rejectFile(data.path);
          break;
        case 'apply-changes':
          promise = this.writeFile(data);
          break;
        case 'get-opened-files':
          promise = this.getOpenedFiles();
          break;
        case 'search-file':
          break;

        // Logging and Messages
        case 'log-to-output':
          promise = this.logToOutput(data);
          break;
        case 'show-error-message':
          promise = this.showErrorMessage(data);
          break;
        case 'show-info-message':
          promise = this.showInfoMessage(data);
          break;

        // Global State Management
        case 'set-global-state':
          promise = this.setGlobalState(data);
          break;
        case 'get-global-state':
          promise = this.getGlobalState(data);
          break;
        case 'delete-global-state':
          promise = this.deleteGlobalState(data);
          break;

        // Workspace State Management
        case 'set-workspace-state':
          promise = this.setWorkspaceState(data);
          break;
        case 'get-workspace-state':
          promise = this.getWorkspaceState(data);
          break;
        case 'delete-workspace-state':
          promise = this.deleteWorkspaceState(data);
          break;

        // Secret State Management
        case 'set-secret-state':
          promise = this.setSecretState(data);
          break;
        case 'get-secret-state':
          promise = this.getSecretState(data);
          break;
        case 'delete-secret-state':
          promise = this.deleteSecretState(data);
          break;
        case 'initiate-login':
          promise = this.initiateLogin(data);
          break;
        case 'get-sessions':
          promise = this.getSessions();
          break;
        case 'get-session-chats':
          promise = this.getSessionChats(data);
          break;
        case 'delete-session':
          promise = this.deleteSession(data);
          break;

        // Extention's focus state
        case "webview-focus-state":
          if (data.focused) {
            this._onWebviewFocused.fire();
          }
          break;
        

        case "workspace-repo-change":
          promise = this.setWorkspaceRepo(data);
          break;
      }


      if (promise) {
        try {
          await promise;
        } catch (err) {
          vscode.window.showErrorMessage(
            'Error handling sidebar message: ' + String(err),
          );
        }
      }



    });
  }
  // For authentication
  private async initiateLogin(data: any) {
    const authenticationManager = new AuthenticationManager(this.context);
    const status = await authenticationManager.initiateAuthentication();
    this.sendMessageToSidebar(status);
  }

  private async setWorkspaceRepo(data: any) {
    this.outputChannel.info(`Setting active repo to via frotnend ${data.repoPath}`);
    this._onDidChangeRepo.fire(data.repoPath);
    return this.setWorkspaceState({key: 'activeRepo', value: data.repoPath});
  }


  // File Operations

  private async acceptFile(path: string) {
    return this.diffViewManager.acceptFile(path);
  }

  private async rejectFile(path: string) {
    return this.diffViewManager.rejectFile(path);
  }

  /**
   * Example of applying changes (like "openDiffView" in your other code)
   */
  private async writeFile(data: { type: string; value: string; filePath: string }) {
    const mappedData = {
      path: data.filePath,
      content: data.value,
    };
    // Debug logs
    console.log('Mapped Data:', mappedData);
    console.log('command write file:', mappedData.path);

    return this.diffViewManager.openDiffView(mappedData);
  }

  private async getOpenedFiles() {
    const basePathSet = new Set<string>();
    const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

    return allTabs
      .filter((tab) => {
        const uri = (tab.input as any)?.uri;
        return uri?.scheme === 'file';
      })
      .map((tab) => {
        const uri = (tab.input as any).uri as vscode.Uri;
        let basePath;
        for (const path of basePathSet) {
          if (uri.fsPath.startsWith(path)) {
            basePath = path;
            break;
          }
        }

        if (!basePath) {
          basePath = this.getFileBasePath(uri);
          basePathSet.add(basePath);
        }

        return {
          id: uri.fsPath,
          type: 'file',
          name: path.basename(uri.fsPath),
          basePath: basePath,
          path: path.relative(basePath, uri.fsPath),
          fsPath: uri.fsPath,
        };
      });
  }


  private getFileBasePath(fileUri: vscode.Uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    return workspaceFolder?.uri.fsPath ?? '';
  }


  // Logging and Messages

  private async logToOutput(data: { type: 'info' | 'warn' | 'error'; message: string }) {
    // For example: this.outputChannel.info(`From Webview: ${data.message}`);
    this.outputChannel[data.type](`From Webview: ${data.message}`);

  }

  private async showErrorMessage(data: { message: string }) {
    vscode.window.showErrorMessage(data.message);
  }

  private async showInfoMessage(data: { message: string }) {
    vscode.window.showInformationMessage(data.message);
  }


  // Global State Management

  private async setGlobalState(data: { key: string; value: any }) {
    console.log('setGlobalState:', data);
    return this.context.globalState.update(data.key, data.value);
  }

  

  private async getGlobalState(data: { key: string }) {
    console.log('this is the saved', this.context.globalState.get(data.key))
    return this.context.globalState.get(data.key);
  }

  private async deleteGlobalState(data: { key: string }) {
    return this.context.globalState.update(data.key, undefined);
  }


  // Workspace State Management

  private async setWorkspaceState(data: { key: string; value: any }) {
    return this.context.workspaceState.update(data.key, data.value);
  }


  private async getWorkspaceState(data: { key: string }) {
    return this.context.workspaceState.get(data.key);
  }

  private async deleteWorkspaceState(data: { key: string }) {
    return this.context.workspaceState.update(data.key, undefined);
  }

  // Secret State Management

  private async setSecretState(data: { key: string; value: string }) {
    return this.context.secrets.store(data.key, data.value);
  }

  private async getSecretState(data: { key: string }) {
    return this.context.secrets.get(data.key);
  }

  private async deleteSecretState(data: { key: string }) {
    return this.context.secrets.delete(data.key);
  }

  async getSessions() {
    try {
      const data = await this.historyService.getPastSessions()
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'sessions-history',
        data: data
      });
    } catch (error) {
      const data: any[] = []
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'sessions-history',
        data: data
      });
    }
  }

  async getSessionChats(sessionData: { sessionId: number }) {
    try {
      const data = await this.historyService.getPastSessionChats(sessionData.sessionId)
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'session-chats-history',
        data: data
      });
    } catch (error) {
      const data: any[] = []
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'session-chats-history',
        data: data
      });
    }
  }

  async deleteSession(data: { sessionId: number }) {
    try {
      await this.historyService.deleteSession(data.sessionId)
    } catch (error) {
      console.error('Error while deleting session:', error);
    }
  }

  setViewType(viewType: 'chat' | 'setting' | 'history' | 'auth') { //add auth view
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'set-view-type',
      data: viewType,
    });
  }

  newChat() {
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'new-chat',
    });
  }

  currentEditorChanged(editor: vscode.TextEditor) {
    if (editor.document.uri.scheme !== 'file') {
      return;
    }

    const uri = editor.document.uri;
    const basePath = this.getFileBasePath(uri);
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'current-editor-changed',
      data: {
        id: uri.fsPath,
        type: 'file',
        name: path.basename(uri.fsPath),
        basePath,
        path: path.relative(basePath, uri.fsPath),
        fsPath: uri.fsPath,
      },
    });
  }






  /**
   * Renders the HTML/JS/CSS for the webview.
   * Adjust paths depending on your project structure.
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, this._extensionUri, [
      'webview-ui',
      'build',
      'assets',
      'index.css',
    ]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, this._extensionUri, [
      'webview-ui',
      'build',
      'assets',
      'index.js',
    ]);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceUri = workspaceFolder?.uri;
    const configPath = workspaceUri
      ? vscode.Uri.joinPath(workspaceUri, 'myext.config.ts').fsPath
      : null;
    let config: any;

    // Attempt to load the config if present
    if (configPath) {
      try {
        config = requireModule(configPath);
      } catch (error) {
        // no-op if not found
      }
    }

    // Watch for config changes
    if (workspaceFolder) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, 'myext.config.ts')
      );
      watcher.onDidChange((uri) => {
        const newConfig = requireModule(uri.path);
        this.sendMessageToSidebar({
          type: 'onConfigChange',
          value: newConfig,
        });
      });
    }

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>AI Code Assist</title>
        </head>
        <body>
          <div id="root"></div>
          <script>
            // Pass any config we found to the webview
            window.config = ${JSON.stringify(config || {})};
          </script>
          <script type="module" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  /**
   * Helper to send messages from extension to webview.
   */
  public sendMessageToSidebar(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    } else {
      console.log('Sidebar is not initialized. Cannot send message.');
      this.pendingMessages.push(message);

    }
  }


  
    

}
