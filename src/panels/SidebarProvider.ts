import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { AuthenticationManager } from '../auth/AuthenticationManager';
import { ChatManager } from '../chat/ChatManager';
import { getUri } from '../utilities/getUri';
import { HistoryService } from '../services/history/HistoryService';
import { AuthService } from '../services/auth/AuthService';
import { ReferenceManager } from '../references/ReferenceManager';
import {
  deleteSessionId,
  getActiveRepo,
  getSessionId,
  setSessionId,
  sendProgress,
  clearWorkspaceStorage,
} from '../utilities/contextManager';
import { api, binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { updateVectorStoreWithResponse } from '../clients/common/websocketHandlers';
import { ConfigManager } from '../utilities/ConfigManager';
import { CLIENT_VERSION, DD_HOST } from '../config';
import { ProfileUiService } from '../services/profileUi/profileUiService';
import { UsageTrackingManager } from '../usageTracking/UsageTrackingManager';
import { Logger } from '../utilities/Logger';
import { DiffManager } from '../diff/diffManager';
import { createNewWorkspaceFn } from '../terminal/workspace/CreateNewWorkspace';
import { ContinueNewWorkspace } from '../terminal/workspace/ContinueNewWorkspace';
import { refreshCurrentToken } from '../services/refreshToken/refreshCurrentToken';
import { SESSION_TYPE } from '../constants';
import { getShell } from '../terminal/utils/shell';
import { FeedbackService } from '../services/feedback/feedbackService';
import { UserQueryEnhancerService } from '../services/userQueryEnhancer/userQueryEnhancerService';
import { ApiErrorHandler } from '../services/api/apiErrorHandler';
import * as fs from 'fs';
import { TerminalManager } from '../terminal/TerminalManager';
import { getOSName } from '../utilities/osName';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private isWebviewInitialized = false;
  private pendingMessages: any[] = [];
  private _onDidChangeRepo = new vscode.EventEmitter<string | undefined>();
  public readonly onDidChangeRepo = this._onDidChangeRepo.event;
  private _onWebviewFocused = new vscode.EventEmitter<void>();
  public readonly onWebviewFocused = this._onWebviewFocused.event;
  private apiErrorHandler = new ApiErrorHandler();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly _extensionUri: vscode.Uri,
    private readonly diffManager: DiffManager,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly logger: Logger,
    private chatService: ChatManager,
    private historyService: HistoryService,
    private authService: AuthService,
    private codeReferenceService: ReferenceManager,
    private configManager: ConfigManager,
    private profileService: ProfileUiService,
    private trackingManager: UsageTrackingManager,
    private feedbackService: FeedbackService,
    private userQueryEnhancerService: UserQueryEnhancerService,
    private continueWorkspace: ContinueNewWorkspace,
    private terminalManager: TerminalManager,
  ) {}

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

      const sendMessage = (message: any) => {
        this.sendMessageToSidebar(message);
      };
      // Depending on `command`, handle each case
      switch (command) {
        case 'api-chat':
          data.message_id = message.id;
          promise = this.chatService.apiChat(data, chunkCallback);
          break;
        case 'api-stop-chat':
          promise = this.chatService.stopChat(); // Calls abort on the active request
          break;
        case 'delete-session-id':
          this.outputChannel.info('Deleting session ID');
          deleteSessionId();
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
        case 'get-client-version':
          promise = this.sendMessageToSidebar({
            id: uuidv4(),
            command: 'send-client-version',
            data: CLIENT_VERSION,
          });
          break;
        case 'keyword-search':
          promise = this.codeReferenceService.keywordSearch(data, sendMessage);
          break;
        case 'keyword-type-search':
          promise = this.codeReferenceService.keywordTypeSearch(data, sendMessage);
          break;
        case 'url-search':
          promise = this.codeReferenceService.urlSearch(data, sendMessage);
          break;
        case 'get-saved-urls':
          promise = this.codeReferenceService.getSavedUrls(data, sendMessage);
          break;
        case 'save-url':
          promise = this.codeReferenceService.saveUrl(data, sendMessage);
          break;
        case 'delete-saved-url':
          promise = this.codeReferenceService.deleteSavedUrl(data, sendMessage);
          break;
        case 'update-saved-url':
          promise = this.codeReferenceService.updateSavedUrl(data, sendMessage);
          break;
        case 'usage-tracking':
          promise = this.trackingManager.trackUsage(data);
          break;

        // File Operations
        case 'accept-file':
          promise = this.diffManager.acceptFile(data.path);
          break;
        case 'reject-file':
          promise = this.diffManager.rejectFile(data.path);
          break;
        case 'get-opened-files':
          promise = this.getOpenedFiles();
          break;
        case 'search-file':
          break;

        // Profile UI data
        case 'fetch-profile-ui-data':
          promise = this.fetchProfileUiData();
          break;
        case 'open-requested-browser-page':
          promise = this.openBrowserPage(data);
          break;
        case 'save-settings':
          promise = this.configManager.saveSettings(data);
          break;

        // Feedback
        case 'submit-feedback':
          promise = this.feedbackService.submitFeedback(data.feedback, data.queryId);
          break;

        // Enhance user query feature
        case 'enhance-user-query':
          promise = this.enhanceUserQuery(data.userQuery);
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
        case 'show-logs':
          promise = this.showLogs();
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
        case 'sign-out':
          promise = this.signOut();
          break;

        // past sessions
        case 'get-sessions':
          promise = this.getSessions(data);
          break;
        case 'get-pinned-sessions':
          promise = this.getPinnedSessions(data);
          break;
        case 'reorder-pinned-sessions':
          promise = this.historyService.reorderPinnedSessions(data);
          break;
        case 'get-session-chats':
          promise = this.getSessionChats(data);
          break;
        case 'delete-session':
          promise = this.deleteSession(data);
          break;
        case 'pin-unpin-session':
          promise = this.historyService.pinOrUnpinSession(data);
          break;

        case 'workspace-repo-change':
          promise = this.setWorkspaceRepo(data);
          break;
        case 'create-new-workspace':
          promise = this.createNewWorkspace(data.tool_use_id);
          break;
        case 'accept-terminal-command':
          this.chatService._onTerminalApprove.fire({
            toolUseId: data.tool_use_id,
            command: data.command,
          });
          break;
        case 'edit-terminal-command':
          promise = this.editTerminalCommand(data);
          break;
        case 'set-shell-integration-timeout':
          this.terminalManager.setShellIntegrationTimeout(data.value);
          this.setGlobalState(data);
          break;

        // diff
        case 'write-file': {
          const activeRepo = getActiveRepo();
          if (!activeRepo) {
            this.outputChannel.error('No active repo found');
            return;
          }
          let usageTrackingSource;
          if (data.is_inline) {
            usageTrackingSource = data.write_mode ? 'inline-chat-act' : 'inline-chat';
          } else {
            usageTrackingSource = data.write_mode ? 'act' : 'chat';
          }
          promise = this.diffManager.applyDiff(
            { path: data.filePath, incrementalUdiff: data.raw_diff },
            activeRepo,
            true,
            {
              usageTrackingSessionId: getSessionId() || null,
              usageTrackingSource: usageTrackingSource,
            },
            data.write_mode,
          );
          break;
        }
        case 'open-file':
          this.openFile(data.path);
          break;

        case 'open-or-create-file':
          this.openOrCreateFileByAbsolutePath(data.path);
          break;

        case 'check-diff-applicable': {
          const activeRepo = getActiveRepo();
          if (!activeRepo) {
            this.outputChannel.error('No active repo found');
            return;
          }
          promise = await this.diffManager.checkIsDiffApplicable(
            { path: data.filePath, incrementalUdiff: data.raw_diff },
            activeRepo,
          );
          break;
        }
        case 'hit-retry-embedding':
          this.hitRetryEmbedding();
          break;

        case 'webview-initialized':
          this.isWebviewInitialized = true;
          this.sendPendingMessages();
          break;
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
          // vscode.window.showErrorMessage(
          //   "Error handling sidebar message: " + String(err)
          // );
        }
      }
    });
  }

  async editTerminalCommand(data: { user_query: string; old_command: string }) {
    try {
      const { user_query, old_command } = data;
      const authToken = await this.authService.loadAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'X-Session-Type': SESSION_TYPE,
        'X-Session-Id': getSessionId(),
      };
      const payload = {
        query: user_query,
        old_terminal_command: old_command,
        os_name: await getOSName(),
        shell: getShell(),
      };
      const response = await api.post(API_ENDPOINTS.TERMINAL_COMMAND_EDIT, payload, {
        headers,
      });
      this.outputChannel.info('Terminal command edit response:', response.data.data.terminal_command);
      refreshCurrentToken(response.headers);
      return response.data.data.terminal_command;
    } catch (error) {
      this.logger.error('Error updating terminal command:');
      this.apiErrorHandler.handleApiError(error);
    }
  }
  // For browser pages
  async openBrowserPage(data: { url: string }) {
    await vscode.env.openExternal(vscode.Uri.parse(data.url));
  }

  // For authentication
  private async initiateLogin(data: any) {
    const authenticationManager = new AuthenticationManager(this.context, this.configManager, this.logger);
    const status = await authenticationManager.initiateAuthentication();
    if (status === 'AUTHENTICATION_FAILED') {
      this.setViewType('error');
    } else {
      this.sendMessageToSidebar(status);
      this.initiateBinary();
    }
  }

  async signOut() {
    const response = await this.authService.deleteAuthToken();
    if (response === 'success') {
      vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', false);
      this.logger.info('Signed out successfully');
      this.outputChannel.info('Signed out successfully');
      this.context.workspaceState.update('isAuthenticated', false);
      this.setViewType('auth');
      clearWorkspaceStorage(true);
    }
  }

  // For Binary init
  public async initiateBinary() {
    this.outputChannel.info('🔧 Initiating Binary **********************************');

    const activeRepo = getActiveRepo();
    const authToken = await this.authService.loadAuthToken();

    if (!authToken) {
      this.outputChannel.warn('❌ No auth token available. Aborting binary initiation.');
      return;
    }
    const sendMessage = (message: any) => {
      this.sendMessageToSidebar(message);
    };
    await this.context.workspaceState.update('authToken', authToken);
    this.configManager.initializeSettings(sendMessage);
    const essentialConfig = this.configManager.getAllConfigEssentials();
    this.outputChannel.info(`📦 Essential config: ${JSON.stringify(essentialConfig)}`);

    this.logger.info('Initiating binary...');
    this.outputChannel.info('🚀 Initiating binary...');
    const payload = {
      config: {
        DEPUTY_DEV: {
          HOST: DD_HOST,
        },
      },
    };

    const headers = {
      Authorization: `Bearer ${authToken}`,
    };

    // this.sendMessageToSidebar({
    //   id: uuidv4(),
    //   command: "repo-selector-state",
    //   data: true,
    // });

    sendProgress({
      repo: activeRepo as string,
      progress: 0,
      status: 'In Progress',
    });

    try {
      let attempts = 0;
      let response: any;
      while (attempts < 3) {
        response = await binaryApi().post(API_ENDPOINTS.INIT_BINARY, payload, { headers });
        this.outputChannel.info(`✅ Binary init status: ${response.data.status}`);
        this.logger.info(`Binary init status: ${response.data.status}`);
        if (response.data.status != 'Completed') {
          attempts++;
          this.outputChannel.info(`🔄 Binary init attempt ${attempts}`);
          if (attempts === 3) {
            this.logger.warn('Binary initialization failed');
            this.outputChannel.warn('🚨 Binary initialization failed.');
            throw new Error('Binary initialization failed');
          }
        } else {
          break;
        }
      }

      if (response.data.status === 'Completed' && activeRepo) {
        this.continueWorkspace.triggerAuthChange(true);
        this.logger.info(`Creating embedding for repository: ${activeRepo}`);
        this.outputChannel.info(`📁 Creating embedding for repo: ${activeRepo}`);

        const params = { repo_path: activeRepo };
        this.outputChannel.info(`📡 Sending WebSocket update: ${JSON.stringify(params)}`);

        try {
          await updateVectorStoreWithResponse(params);
        } catch (error) {
          this.logger.warn('Embedding failed');
          this.outputChannel.warn('Embedding failed');
        }
      }
    } catch (error) {
      this.logger.error('Binary initialization failed');
      this.outputChannel.error('🚨 Binary initialization failed.');
      throw new Error('Binary initialization failed');
    }
  }

  async hitRetryEmbedding() {
    const activeRepo = getActiveRepo();
    if (!activeRepo) {
      return;
    }
    const params = { repo_path: activeRepo, retried_by_user: true };
    this.outputChannel.info(`📡 Sending WebSocket update: ${JSON.stringify(params)}`);
    try {
      await updateVectorStoreWithResponse(params);
    } catch (error) {
      this.logger.warn('Embedding failed');
      this.outputChannel.warn('Embedding failed');
    }
  }

  private async setWorkspaceRepo(data: any) {
    this.outputChannel.info(`Setting active repo to via frotnend ${data.repoPath}`);
    this._onDidChangeRepo.fire(data.repoPath);
    return this.setWorkspaceState({ key: 'activeRepo', value: data.repoPath });
  }

  // File Operations
  private async openFile(file_path: string) {
    const active_repo = getActiveRepo();
    if (!active_repo) {
      vscode.window.showErrorMessage('No workspace folder found.');
      return;
    } else {
      const absolutePath = path.join(active_repo, file_path);
      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    }
  }

  private async openOrCreateFileByAbsolutePath(filePath: string) {
    const uri = vscode.Uri.file(filePath);
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
      }
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to open or create file: ${error.message}`);
    }
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

  private async showLogs() {
    await this.logger.showCurrentProcessLogs();
  }

  // Global State Management

  private async setGlobalState(data: { key: string; value: any }) {
    return this.context.globalState.update(data.key, data.value);
  }

  private async getGlobalState(data: { key: string }) {
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

  async enhanceUserQuery(userQuery: string) {
    try {
      const response = await this.userQueryEnhancerService.generateEnhancedUserQuery(userQuery);
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'enhanced-user-query',
        data: { enhancedUserQuery: response.enhanced_query },
      });
    } catch (error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'enhanced-user-query',
        data: { error: error },
      });
    }
  }

  async getSessions(data: { limit: number; offset: number }) {
    try {
      const response = await this.historyService.getPastSessions(data.limit, data.offset, 'UNPINNED');
      const unpinnedSessions = response.sessions;
      const hasMore = response.has_more;
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'sessions-history',
        data: { unpinnedSessions, hasMore },
      });
    } catch (error) {
      const unpinnedSessions: any[] = [];
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'sessions-history',
        data: { unpinnedSessions, hasMore: false },
      });
    }
  }

  async getPinnedSessions(data: { limit: number; offset: number }) {
    try {
      const response = await this.historyService.getPastSessions(data.limit, data.offset, 'PINNED');
      const pinnedSessions = response.sessions;

      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'pinned-sessions',
        data: pinnedSessions,
      });
    } catch (error) {
      const pinnedSessions: any[] = [];
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'pinned-sessions',
        data: pinnedSessions,
      });
    }
  }

  async getSessionChats(sessionData: { sessionId: number }) {
    try {
      const response = await this.historyService.getPastSessionChats(sessionData.sessionId);
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'session-chats-history',
        data: response,
      });
      setSessionId(sessionData.sessionId);
    } catch (error) {
      const response: any[] = [];
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'session-chats-history',
        data: response,
      });
    }
  }

  async deleteSession(data: { sessionId: number }) {
    try {
      await this.historyService.deleteSession(data.sessionId);
    } catch (error) {
      // console.error("Error while deleting session:", error);
    }
  }
  async sendPendingMessages() {
    // Flush any pending messages now that the view is initialized
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      this._view?.webview.postMessage(message);
    }
  }

  async createNewWorkspace(tool_use_id: string) {
    createNewWorkspaceFn(tool_use_id, this.context, this.outputChannel);
  }

  setViewType(
    viewType:
      | 'chat'
      | 'setting'
      | 'history'
      | 'auth'
      | 'profile'
      | 'error'
      | 'loader'
      | 'force-upgrade'
      | 'faq'
      | 'help',
  ) {
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'set-view-type',
      data: viewType,
    });
  }

  setAuthStatus(status: boolean) {
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'set-auth-status',
      data: status,
    });
  }

  fetchProfileUiData() {
    this.profileService.getProfileUi().then((response) => {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'profile-ui-data',
        data: response.ui_profile_data,
      });
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

  async addSelectedTerminalOutputToChat(output: string) {
    await vscode.commands.executeCommand('deputydev-sidebar.focus');
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'terminal-output-to-chat',
      data: {
        terminalOutput: `Terminal output:\n\`\`\`\n${output}\n\`\`\``,
      },
    });
  }

  /**
   * Renders the HTML/JS/CSS for the webview.
   * Adjust paths depending on your project structure.
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, this._extensionUri, ['webviews', 'sidebar', 'build', 'assets', 'index.css']);
    // The JS file from the React build output
    const scriptUri = getUri(webview, this._extensionUri, ['webviews', 'sidebar', 'build', 'assets', 'index.js']);

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
    if (this._view && this.isWebviewInitialized) {
      this._view.webview.postMessage(message);
    } else {
      // console.log("Webview not initialized, queuing message:", message);
      this.pendingMessages.push(message);
    }
  }
}
