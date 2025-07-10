import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { ErrorTrackingManager } from '../analyticsTracking/ErrorTrackingManager';
import { UsageTrackingManager } from '../analyticsTracking/UsageTrackingManager';
import { AuthenticationManager } from '../auth/AuthenticationManager';
import { ChatManager } from '../chat/ChatManager';
import { IndexingService } from '../services/indexing/indexingService';
import { CLIENT_VERSION, DD_HOST, MCP_CONFIG_PATH } from '../config';
import { DiffManager } from '../diff/diffManager';
import { ReferenceManager } from '../references/ReferenceManager';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { AuthService } from '../services/auth/AuthService';
import { FeedbackService } from '../services/feedback/feedbackService';
import { HistoryService } from '../services/history/HistoryService';
import { MCPService } from '../services/mcp/mcpService';
import { ProfileUiService } from '../services/profileUi/profileUiService';
import { TerminalService } from '../services/terminal/TerminalService';
import { UserQueryEnhancerService } from '../services/userQueryEnhancer/userQueryEnhancerService';
import { ContinueNewWorkspace } from '../terminal/workspace/ContinueNewWorkspace';
import { createNewWorkspaceFn } from '../terminal/workspace/CreateNewWorkspace';
import { ConfigManager } from '../utilities/ConfigManager';
import {
  clearWorkspaceStorage,
  deleteSessionId,
  getActiveRepo,
  getSessionId,
  sendProgress,
  setSessionId,
} from '../utilities/contextManager';
import { getUri } from '../utilities/getUri';
import { Logger } from '../utilities/Logger';
import { fileExists, openFile } from '../utilities/path';

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private _view?: vscode.WebviewView;
  private isWebviewInitialized = false;
  private readonly pendingMessages: any[] = [];
  private readonly _onDidChangeRepo = new vscode.EventEmitter<string | undefined>();
  public readonly onDidChangeRepo = this._onDidChangeRepo.event;
  private readonly _onDidChangeContextRepos = new vscode.EventEmitter<string | undefined>();
  public readonly onDidChangeContextRepos = this._onDidChangeContextRepos.event;
  private readonly mcpService = new MCPService();
  private readonly terminalService = new TerminalService();
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly _extensionUri: vscode.Uri,
    private readonly diffManager: DiffManager,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly logger: Logger,
    private readonly chatService: ChatManager,
    private readonly historyService: HistoryService,
    private readonly authService: AuthService,
    private readonly codeReferenceService: ReferenceManager,
    private readonly configManager: ConfigManager,
    private readonly profileService: ProfileUiService,
    private readonly trackingManager: UsageTrackingManager,
    private readonly feedbackService: FeedbackService,
    private readonly userQueryEnhancerService: UserQueryEnhancerService,
    private readonly errorTrackingManager: ErrorTrackingManager,
    private readonly continueWorkspace: ContinueNewWorkspace,
    private readonly indexingService: IndexingService,
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
          this.outputChannel.info('Deleting session ID and killing all processes');
          this.chatService.killAllProcesses();
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
        case 'upload-file-to-s3':
          promise = this.codeReferenceService.uploadFileToS3(data, sendMessage);
          break;

        case 'download-image-file':
          promise = this.codeReferenceService.downloadImageFile(data);
          break;

        case 'delete-image':
          promise = this.codeReferenceService.deleteImage(data);
          break;

        case 'usage-tracking': {
          const sessionId = getSessionId();
          if (sessionId) {
            promise = this.trackingManager.trackUsage({
              ...data,
              sessionId: sessionId,
            });
          }
          break;
        }
        case 'show-vscode-message-box':
          if (data.type === 'info') {
            vscode.window.showInformationMessage(data.message);
          } else if (data.type === 'error') {
            vscode.window.showErrorMessage(data.message);
          } else if (data.type === 'warning') {
            vscode.window.showWarningMessage(data.message);
          }
          break;

        // MCP operations
        case 'sync-servers':
          this.startPollingMcpServers();
          promise = this.syncMcpServers();
          break;

        case 'mcp-server-enable-or-disable':
          promise = this.mcpServerEnableOrDisable(data.action, data.serverName);
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
        case 'log-to-log-file':
          promise = this.logToLogFile(data);
          break;
        case 'show-logs':
          promise = this.showLogs();
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

        case 'update-context-repositories':
          this.updateContextRepositories(data);
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
          promise = this.terminalService.editTerminalCommand(data);
          break;

        case 'tool-use-approval-update':
          this.chatService._onToolUseApprove.fire({
            toolUseId: data.toolUseId,
            autoAcceptNextTime: data.autoAcceptNextTime,
            approved: data.approved,
          });
          break;

        case 'kill-terminal-process':
          this.outputChannel.info(`Killing terminal process with ID: ${data.tool_use_id}`);
          this.chatService.killProcessById(data.tool_use_id);
          break;
        case 'kill-all-terminal-processes':
          this.outputChannel.info('Killing all terminal processes');
          this.chatService.killAllProcesses();
          break;
        case 'set-shell-integration-timeout':
          this.setGlobalState(data);
          break;
        case 'set-disable-shell-integration':
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

        case 'accept-all-changes-in-session': {
          await this.diffManager.acceptAllFilesForSession(data.sessionId);
          this.sendMessageToSidebar({
            id: message.id,
            command: 'all-session-changes-finalized',
            data: { sessionId: data.sessionId },
          });
          break;
        }

        case 'reject-all-changes-in-session': {
          await this.diffManager.rejectAllFilesForSession(data.sessionId);
          this.sendMessageToSidebar({
            id: message.id,
            command: 'all-session-changes-finalized',
            data: { sessionId: data.sessionId },
          });
          break;
        }

        case 'accept-all-changes-in-file': {
          await this.diffManager.acceptFile(data.filePath, data.repoPath);
          this.sendMessageToSidebar({
            id: message.id,
            command: 'all-file-changes-finalized',
            data: { filePath: data.filePath, repoPath: data.repoPath },
          });
          const nextFileInSession = await this.diffManager.getNextFileForSession(data.sessionId);
          if (nextFileInSession) {
            await this.diffManager.openDiffView(nextFileInSession.filePath, nextFileInSession.repoPath);
          }
          break;
        }

        case 'reject-all-changes-in-file': {
          await this.diffManager.rejectFile(data.filePath, data.repoPath);
          this.sendMessageToSidebar({
            id: message.id,
            command: 'all-file-changes-finalized',
            data: { filePath: data.filePath, repoPath: data.repoPath },
          });
          const nextFileInSession = await this.diffManager.getNextFileForSession(data.sessionId);
          if (nextFileInSession) {
            await this.diffManager.openDiffView(nextFileInSession.filePath, nextFileInSession.repoPath);
          }
          break;
        }

        case 'open-diff-viewer-for-file': {
          await this.diffManager.openDiffView(data.filePath, data.repoPath);
          break;
        }

        case 'open-file':
          openFile(data.path, data.startLine, data.endLine, data.forActiveFile);
          break;

        case 'reveal-folder-in-explorer':
          this.revealFolderInExplorer(data.folderPath);
          break;

        case 'open-or-create-file':
          this.openOrCreateFileByAbsolutePath(data.path);
          break;

        case 'open-mcp-settings':
          this.openMcpSettings();
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

        case 'hit-embedding':
          this.hitEmbedding(data.repoPath);
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
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'auth-response',
        data: 'AUTHENTICATED',
      });
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
    this.outputChannel.info('🔧 Initiating Binary');

    const activeRepo = getActiveRepo();
    const authToken = await this.authService.loadAuthToken();

    if (!authToken) {
      this.outputChannel.warn('❌ No auth token available. Aborting binary initiation.');
      return;
    }

    const sendMessage = (message: any) => {
      this.sendMessageToSidebar(message);
    };
    await this.context.secrets.store('authToken', authToken);
    this.configManager.initializeSettings(sendMessage);
    const essentialConfig = this.configManager.getAllConfigEssentials();
    this.outputChannel.info(`📦 Essential config: ${JSON.stringify(essentialConfig)}`);

    // Prepare binary init payload
    this.logger.info('Initiating binary...');
    this.outputChannel.info('🚀 Initiating binary...');

    const payload = {
      config: {
        DEPUTY_DEV: {
          HOST: DD_HOST,
        },
      },
      mcp_config_path: MCP_CONFIG_PATH,
    };

    const headers = {
      Authorization: `Bearer ${authToken}`,
    };
    if (activeRepo) {
      sendProgress({
        task: 'INDEXING',
        status: 'IN_PROGRESS',
        repo_path: activeRepo,
        progress: 0,
        indexing_status: [],
        is_partial_state: false,
      });
    }

    let response: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await binaryApi().post(API_ENDPOINTS.INIT_BINARY, payload, { headers });
        this.outputChannel.info(`✅ Binary init status: ${response.data.status}`);

        if (response.data.status === 'COMPLETED') {
          this.outputChannel.info('Binary initialization completed successfully.');
          this.logger.info('Binary initialization completed successfully.');
          break;
        } else if (attempt < 3) {
          this.outputChannel.info(`🔄 Retrying binary init (attempt ${attempt + 1})...`);
          this.logger.info(`Binary init status: ${response.data.status}`);
        } else {
          throw new Error('Binary initialization failed after 3 attempts.');
        }
      } catch (err) {
        if (attempt === 3) {
          this.logger.warn('Binary initialization failed');
          this.outputChannel.warn('🚨 Binary initialization failed.');
          this.errorTrackingManager.trackGeneralError(err, 'BINARY_INIT_ERROR', 'BINARY');
          this.setViewType('error');
          throw err;
        }
      }
    }

    if (response?.data?.status !== 'COMPLETED') return;
    // Start services regardless of activeRepo status
    this.startPollingMcpServers();
    this.syncMcpServers();

    if (!activeRepo) return;

    this.logger.info(`Creating embedding for repository: ${activeRepo}`);
    this.outputChannel.info(`📁 Creating embedding for repo: ${activeRepo}`);

    this.continueWorkspace.triggerAuthChange(true);

    const params = { repo_path: activeRepo };
    this.outputChannel.info(`📡 Sending WebSocket update: ${JSON.stringify(params)}`);

    try {
      await this.indexingService.updateVectorStoreWithResponse(params);
    } catch (error) {
      this.logger.warn('Embedding failed');
      this.outputChannel.warn('Embedding failed');
      this.errorTrackingManager.trackGeneralError(error, 'EMBEDDING_ERROR', 'BINARY');
      throw error;
    }
  }

  async hitEmbedding(repoPath: string) {
    if (!repoPath) {
      return;
    }
    const params = { repo_path: repoPath, retried_by_user: true };
    this.outputChannel.info(`📡 Sending WebSocket update: ${JSON.stringify(params)}`);
    try {
      await this.indexingService.updateVectorStoreWithResponse(params);
    } catch (error) {
      this.errorTrackingManager.trackGeneralError(error, 'RETRY_EMBEDDING_ERROR', 'BINARY');
      this.logger.warn('Embedding failed');
      this.outputChannel.warn('Embedding failed');
    }
  }

  private async updateContextRepositories(data: any) {
    this.setWorkspaceState({ key: 'contextRepositories', value: data.contextRepositories });
    this._onDidChangeContextRepos.fire('');
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

  private async revealFolderInExplorer(folderPath: string) {
    const activeRepo = getActiveRepo();
    if (!activeRepo) {
      vscode.window.showErrorMessage('No workspace folder found.');
      return;
    }
    const absolutePath = path.join(activeRepo, folderPath);
    const uri = vscode.Uri.file(absolutePath);
    try {
      await vscode.commands.executeCommand('revealInExplorer', uri);
    } catch (error: any) {
      // vscode.window.showErrorMessage(`Failed to reveal folder in explorer: ${error.message}`);
    }
  }

  private async openOrCreateFileByAbsolutePath(filePath: string) {
    const uri = vscode.Uri.file(filePath);
    try {
      if (!(await fileExists(uri))) {
        await vscode.workspace.fs.writeFile(uri, new Uint8Array()); // create empty file
      }
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to open or create file: ${error.message}`);
    }
  }

  private async openMcpSettings() {
    const uri = vscode.Uri.file(MCP_CONFIG_PATH);
    try {
      if (!(await fileExists(uri))) {
        await vscode.workspace.fs.writeFile(uri, new Uint8Array());
      }
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to open or create mcp settings file: ${error.message}`);
      this.errorTrackingManager.trackGeneralError(error, 'OPEN_MCP_SETTINGS_ERROR', 'EXTENSION');
    }
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

  private async logToLogFile(data: { type: 'info' | 'warn' | 'error'; message: string }) {
    this.logger[data.type](`From Webview: ${data.message}`);
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
    const response: any[] = [];
    try {
      const sessionResponse = await this.historyService.getPastSessionChats(sessionData.sessionId);
      setSessionId(sessionData.sessionId);
      return sessionResponse;
    } catch {
      return response;
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
      | 'code-review'
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

  // MCP Operations
  async startPollingMcpServers() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.pollingInterval = setInterval(async () => {
      try {
        await this.getAllServers();
      } catch (error) {
        this.logger.error('Error while polling MCP servers:');
      }
    }, 2000);
  }

  async getAllServers() {
    const response = await this.mcpService.getAllMcpServers();
    if (response.is_error && response.meta && response.meta.message) {
      // vscode.window.showInformationMessage(response.meta.message);
    }
    if (response && response.data && !response.is_error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'fetched-mcp-servers',
        data: response.data,
      });
    }
  }
  async syncMcpServers() {
    const response = await this.mcpService.syncServers();
    if (response.is_error && response.meta && response.meta.message) {
      vscode.window.showInformationMessage(response.meta.message);
    }
    if (response && response.data && !response.is_error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'fetched-mcp-servers',
        data: response.data,
      });
      vscode.window.showInformationMessage('MCP servers synced successfully.');
    }
  }

  async mcpServerEnableOrDisable(action: 'enable' | 'disable', serverName: string) {
    let response;
    if (action === 'enable') {
      response = await this.mcpService.enableServer(serverName);
    } else {
      response = await this.mcpService.disableServer(serverName);
    }

    if (response.is_error && response.meta && response.meta.message) {
      vscode.window.showInformationMessage(response.meta.message);
    }
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

  public dispose(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    // Optionally clear any other resources here
  }
  /**
   * Helper to send messages from extension to webview.
   */
  public sendMessageToSidebar(message: any) {
    if (this._view && this.isWebviewInitialized) {
      this._view.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }
}
