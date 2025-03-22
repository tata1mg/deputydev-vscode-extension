import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { AuthenticationManager } from "../auth/AuthenticationManager";
import { ChatManager } from "../chat/ChatManager";
import { DiffViewManager } from "../diff/DiffManager";
import { getUri } from "../utilities/getUri";
import { requireModule } from "../utilities/require-config";
import { WorkspaceManager } from "../code_syncing/WorkspaceManager";
import { HistoryService } from "../services/history/HistoryService";
import { AuthService } from "../services/auth/AuthService";
import { ReferenceManager } from "../references/ReferenceManager";
import { getActiveRepo, setSessionId } from "../utilities/contextManager";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { binaryApi } from "../services/api/axios";
import { API_ENDPOINTS } from "../services/api/endpoints";
import { updateVectorStoreWithResponse } from "../clients/common/websocketHandlers";
import { ConfigManager } from "../utilities/ConfigManager";
import { DD_HOST } from "../config";
export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private pendingMessages: any[] = [];
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
    private authService: AuthService,
    private codeReferenceService: ReferenceManager,
    private configManager: ConfigManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context?: vscode.WebviewViewResolveContext,
    _token?: vscode.CancellationToken
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
          command: "chunk",
          data: chunkData,
        });
      };

      const sendMessage = (message: any) => {
        this.sendMessageToSidebar(message);
      };
      // Depending on `command`, handle each case
      switch (command) {
        case "api-chat":
          console.log("api-chat data:", data);
          data.message_id = message.id;
          promise = this.chatService.apiChat(data, chunkCallback);
          break;
        case 'api-stop-chat': // ✅ Add logic to stop chat
          console.log('Stopping chat...');
          promise = this.chatService.stopChat(); // Calls abort on the active request
          break;
        // case 'api-clear-chat':
        //   promise = this.chatService.apiClearChat();
        //   break;
        // case 'api-save-session':
        //   promise = this.chatService.apiSaveSession(data);
        //   break;
        // case 'api-chat-setting':
        //   promise = this.chatService.apiChatSetting(data);
        // break;
        case "keyword-search":
          promise = this.codeReferenceService.keywordSearch(data, sendMessage);
          break;
        case "keyword-type-search":
          promise = this.codeReferenceService.keywordTypeSearch(
            data,
            sendMessage
          );
          break;

        // File Operations
        case "accept-file":
          promise = this.acceptFile(data.path);
          break;
        case "reject-file":
          promise = this.rejectFile(data.path);
          break;
        case "apply-changes":
          promise = this.writeFile(data);
          break;
        case "get-opened-files":
          promise = this.getOpenedFiles();
          break;
        case "search-file":
          break;

        // Logging and Messages
        case "log-to-output":
          promise = this.logToOutput(data);
          break;
        case "show-error-message":
          promise = this.showErrorMessage(data);
          break;
        case "show-info-message":
          promise = this.showInfoMessage(data);
          break;

        // Global State Management
        case "set-global-state":
          promise = this.setGlobalState(data);
          break;
        case "get-global-state":
          promise = this.getGlobalState(data);
          break;
        case "delete-global-state":
          promise = this.deleteGlobalState(data);
          break;

        // Workspace State Management
        case "set-workspace-state":
          promise = this.setWorkspaceState(data);
          break;

        case "get-workspace-state":
          console.log("[DEBUG] Handling get-workspace-state request:", data);
          promise = this.getWorkspaceState(data);
          promise.then((res: any) =>
            console.log("[DEBUG] Workspace state retrieved:", res)
          );
          break;

        case "delete-workspace-state":
          promise = this.deleteWorkspaceState(data);
          break;

        // Secret State Management
        case "set-secret-state":
          promise = this.setSecretState(data);
          break;
        case "get-secret-state":
          promise = this.getSecretState(data);
          break;
        case "delete-secret-state":
          promise = this.deleteSecretState(data);
          break;
        case "initiate-login":
          promise = this.initiateLogin(data);
          break;
        case "initiate-binary":
          promise = this.initiateBinary(data);
          break;
        case "get-sessions":
          promise = this.getSessions(data);
          break;
        case "get-session-chats":
          promise = this.getSessionChats(data);
          break;
        case "delete-session":
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

        // diff
        case "write-file":
          promise = this.writeFile(data);
          break;
        case "open-file":
          this.openFile(data.path);
      }

      if (promise) {
        try {
          const result = await promise;
          this.sendMessageToSidebar({
            id: message.id,
            command: 'result',
            data: result,
          });
        } catch (err) {
          vscode.window.showErrorMessage(
            "Error handling sidebar message: " + String(err)
          );
        }
      }
    });
  }
  // For authentication
  private async initiateLogin(data: any) {
    const authenticationManager = new AuthenticationManager(this.context , this.configManager);
    const status = await authenticationManager.initiateAuthentication();
    this.sendMessageToSidebar(status);
  }

  // For Binary init
  private async initiateBinary(data: any) {
    const active_repo = getActiveRepo();
    //  measure time tken for auth token
    // start
    const start = new Date().getTime();
    const auth_token = await this.authService.loadAuthToken();
    const end = new Date().getTime();
    const time = end - start;
    this.outputChannel.info(`Time taken to load auth token: ${time}ms`);
    this.context.workspaceState.update("authToken", auth_token);
    const essential_config = this.configManager.getConfigEssentials();
    this.outputChannel.info(`Essential config: ${JSON.stringify(essential_config)}`);
    if (!auth_token) {
      return;
    }
    this.outputChannel.info("Initiating binary...");
    const payload = {
      config: {
        DEPUTY_DEV: {
          HOST: essential_config["HOST_AND_TIMEOUT"]["HOST"] ? essential_config["HOST_AND_TIMEOUT"]["HOST"] : DD_HOST ,
        },
      },
    };
    const headers = {
      Authorization: `Bearer ${auth_token}`,
    };

    this.sendMessageToSidebar({
      id: uuidv4(),
      command: "repo-selector-state",
      data: true,
    });

    const response = await binaryApi.post(API_ENDPOINTS.INIT_BINARY, payload, {
      headers,
    });
    this.outputChannel.info(response.data.status);
    if (response.data.status === "Completed") {
      if (active_repo) {
        this.outputChannel.info(`Embedding creation with repo ${active_repo}`);
        const params = { repo_path: active_repo };
        this.outputChannel.info(
          `📡 📡📡 Sending WebSocket update via workspace manager: ${JSON.stringify(params)}`
        );
        await updateVectorStoreWithResponse(params).then((response) => {
          this.sendMessageToSidebar({
            id: uuidv4(),
            command: "repo-selector-state",
            data: false,
          });
          this.outputChannel.info(
            `📡 📡📡 WebSocket response: ${JSON.stringify(response)}`
          );
        });
      }
    }
  }

  private async setWorkspaceRepo(data: any) {
    this.outputChannel.info(
      `Setting active repo to via frotnend ${data.repoPath}`
    );
    this._onDidChangeRepo.fire(data.repoPath);
    return this.setWorkspaceState({ key: "activeRepo", value: data.repoPath });
  }

  // File Operations

  private async acceptFile(path: string) {
    return this.diffViewManager.acceptFile(path);
  }

  private async rejectFile(path: string) {
    return this.diffViewManager.rejectFile(path);
  }

  private async openFile(file_path: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found.");
    } else {
      const absolutePath = path.join(workspaceFolder, file_path);
      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    }
  }

  /**
   * Example of applying changes (like "openDiffView" in your other code)
   */

  private async writeFile(data: { filePath: string; raw_diff: string }) {
    const modifiedFiles = (await this.chatService.getModifiedRequest({
      filepath: data.filePath,
      raw_diff: data.raw_diff,
    })) as Record<string, string>;

    this.outputChannel.info(`Writing file(s) for: ${data.filePath}`);

    const active_repo = getActiveRepo();
    if (!active_repo) {
      this.outputChannel.error("No active repo found");
      return;
    }
    this.chatService.handleModifiedFiles(modifiedFiles, active_repo);
    return;
  }

  private async getOpenedFiles() {
    const basePathSet = new Set<string>();
    const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

    return allTabs
      .filter((tab) => {
        const uri = (tab.input as any)?.uri;
        return uri?.scheme === "file";
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
          type: "file",
          name: path.basename(uri.fsPath),
          basePath: basePath,
          path: path.relative(basePath, uri.fsPath),
          fsPath: uri.fsPath,
        };
      });
  }

  private getFileBasePath(fileUri: vscode.Uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    return workspaceFolder?.uri.fsPath ?? "";
  }

  // Logging and Messages

  private async logToOutput(data: {
    type: "info" | "warn" | "error";
    message: string;
  }) {
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
    console.log("setGlobalState:", data);
    return this.context.globalState.update(data.key, data.value);
  }

  private async getGlobalState(data: { key: string }) {
    console.log("this is the saved", this.context.globalState.get(data.key));
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

  async getSessions(data: { limit: number; offset: number }) {
    try {
      const response = await this.historyService.getPastSessions(
        data.limit,
        data.offset
      );
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: "sessions-history",
        data: response,
      });
    } catch (error) {
      const response: any[] = [];
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: "sessions-history",
        data: response,
      });
    }
  }

  async getSessionChats(sessionData: { sessionId: number }) {
    try {
      const response = await this.historyService.getPastSessionChats(
        sessionData.sessionId
      );
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: "session-chats-history",
        data: response,
      });
      setSessionId(sessionData.sessionId);
    } catch (error) {
      const response: any[] = [];
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: "session-chats-history",
        data: response,
      });
    }
  }

  async deleteSession(data: { sessionId: number }) {
    try {
      await this.historyService.deleteSession(data.sessionId);
    } catch (error) {
      console.error("Error while deleting session:", error);
    }
  }

  setViewType(viewType: "chat" | "setting" | "history" | "auth" | "profile") {
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: "set-view-type",
      data: viewType,
    });
  }

  setAuthStatus(status: boolean) {
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: "set-auth-status",
      data: status,
    });
  }



  newChat() {
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: "new-chat",
    });
  }

  currentEditorChanged(editor: vscode.TextEditor) {
    if (editor.document.uri.scheme !== "file") {
      return;
    }

    const uri = editor.document.uri;
    const basePath = this.getFileBasePath(uri);
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: "current-editor-changed",
      data: {
        id: uri.fsPath,
        type: "file",
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
      "webview-ui",
      "build",
      "assets",
      "index.css",
    ]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, this._extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.js",
    ]);

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceUri = workspaceFolder?.uri;
    const configPath = workspaceUri
      ? vscode.Uri.joinPath(workspaceUri, "myext.config.ts").fsPath
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
        new vscode.RelativePattern(workspaceFolder, "myext.config.ts")
      );
      watcher.onDidChange((uri) => {
        const newConfig = requireModule(uri.path);
        this.sendMessageToSidebar({
          type: "onConfigChange",
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
      console.log("Sidebar is not initialized. Cannot send message.");
      this.pendingMessages.push(message);
    }
  }
}
