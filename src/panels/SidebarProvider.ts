import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { ErrorTrackingManager } from '../analyticsTracking/ErrorTrackingManager';
import { UsageTrackingManager } from '../analyticsTracking/UsageTrackingManager';
import { AuthenticationManager } from '../auth/AuthenticationManager';
import { ChatManager } from '../chat/ChatManager';
import { CommentHandler } from '../codeReview/CommentHandler';
import { CodeReviewManager } from '../codeReviewManager/CodeReviewManager';
import { BINARY_DD_HOST, CLIENT_VERSION, MCP_CONFIG_PATH } from '../config';
import { CodeReviewDiffManager } from '../diff/codeReviewDiff/codeReviewDiffManager';
import { DiffManager } from '../diff/diffManager';
import { ReferenceManager } from '../references/ReferenceManager';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { AuthService } from '../services/auth/AuthService';
import { ReviewService } from '../services/codeReview/CodeReviewService';
import { FeedbackService } from '../services/feedback/feedbackService';
import { HistoryService } from '../services/history/HistoryService';
import { IndexingService } from '../services/indexing/indexingService';
import { MCPService } from '../services/mcp/mcpService';
import { ProfileUiService } from '../services/profileUi/profileUiService';
import { TerminalService } from '../services/terminal/TerminalService';
import { UserQueryEnhancerService } from '../services/userQueryEnhancer/userQueryEnhancerService';
import { ContinueNewWorkspace } from '../terminal/workspace/ContinueNewWorkspace';
import { createNewWorkspaceFn } from '../terminal/workspace/CreateNewWorkspace';
import { AgentPayload, ChatStatusMsg, NewReview } from '../types';
import { ConfigManager } from '../utilities/ConfigManager';
import {
  clearWorkspaceStorage,
  deleteSessionId,
  getActiveRepo,
  getRepoAndRelativeFilePath,
  getSessionId,
  sendProgress,
  setReviewId,
  setReviewSessionId,
  setSessionId,
} from '../utilities/contextManager';
import { getUri } from '../utilities/getUri';
import { checkFileExists, fileExists, openFile } from '../utilities/path';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { formatSessionChats } from '../utilities/sessionChatsFormatter';

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
  private logger: ReturnType<typeof SingletonLogger.getInstance>;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly _extensionUri: vscode.Uri,
    private readonly diffManager: DiffManager,
    private readonly outputChannel: vscode.LogOutputChannel,
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
    private readonly reviewService: ReviewService,
    private readonly codeReviewDiffManager: CodeReviewDiffManager,
    private readonly commentHandler: CommentHandler,
    private readonly codeReviewManager: CodeReviewManager,
  ) {
    this.logger = SingletonLogger.getInstance();
  }

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
        // Code Review
        case 'code-review-pre-process':
          this.outputChannel.info('Pre-processing code review...');
          this.handleCodeReviewPreProcess(data);
          break;
        case 'start-code-review':
          this.outputChannel.info('Starting code review...');
          this.handleCodeReviewStart(data);
          break;
        case 'cancel-review':
          this.outputChannel.info('Stopping code review...');
          this.codeReviewManager.cancelReview();
          this.reviewService.cancelReview();
          break;
        case 'code-review-post-process':
          this.outputChannel.info('Post-processing code review...');
          this.handleCodeReviewPostProcess(data);
          break;
        case 'new-review':
          this.newReview(data);
          break;
        case 'reset-review':
          this.resetReview(data);
          break;
        case 'hit-snapshot':
          this.handleSnapshot(data);
          break;
        case 'search-branches':
          this.searchBranches(data.keyword);
          break;
        case 'open-file-diff':
          this.handleDiffForCodeReview(data);
          break;
        case 'fetch-past-reviews':
          this.fetchPastReviews(data);
          break;
        case 'get-repo-details-for-review':
          this.getRepoDetailsForReview(data);
          break;
        case 'open-comment-in-file':
          this.handleOpenCommentInFile(data);
          break;
        case 'fetch-user-agents':
          this.fetchUserAgents();
          break;
        case 'user-agent-crud':
          this.userAgentCrud(data.operation, data.agent_id, data.agent_name, data.custom_prompt);
          break;
        case 'send-comment-status-update':
          this.reviewService.updateCommentStatus(data.commentId, data.status);
          break;
        case 'review-notification':
          this.reviewNotification(data.reviewStatus);
          break;
        case 'submit-comment-feedback':
          this.submitCommentFeedback(data);
          break;

        // Code Generation
        case 'api-chat':
          data.message_id = message.id;
          promise = this.chatService.apiChat(data, chunkCallback);
          break;
        case 'api-stop-chat':
          promise = this.chatService.stopChat(data.sessionId, data.chatId); // Calls abort on the active request
          break;
        case 'kill-all-processes':
          this.outputChannel.info('killing all processes');
          this.chatService.killAllProcesses();
          break;
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
          promise = this.feedbackService.submitFeedback(data.feedback, data.queryId, data.sessionId);
          break;

        // Enhance user query feature
        case 'enhance-user-query':
          promise = this.enhanceUserQuery(data.userQuery, data.sessionId);
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
          promise = this.createNewWorkspace(data.tool_use_id, data.chatId);
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
        case 'on-action-required':
          this.onActionRequiredNotification(data.chatId, data.chatStatusMsg, data.summary);
          break;

        // terminal
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
          const { repoPath, relativeFilePath } = await getRepoAndRelativeFilePath(data.filePath);

          let usageTrackingSource;
          if (data.is_inline) {
            usageTrackingSource = data.write_mode ? 'inline-chat-act' : 'inline-chat';
          } else {
            usageTrackingSource = data.write_mode ? 'act' : 'chat';
          }
          promise = this.diffManager.applyDiff(
            { path: relativeFilePath, incrementalUdiff: data.raw_diff },
            repoPath,
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
          promise = this.diffManager.acceptAllFilesForSession(data.sessionId);
          break;
        }

        case 'reject-all-changes-in-session': {
          promise = this.diffManager.rejectAllFilesForSession(data.sessionId);
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

        case 'check-file-exists':
          promise = checkFileExists(data.filePath);
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
          const { repoPath, relativeFilePath } = await getRepoAndRelativeFilePath(data.filePath);
          promise = await this.diffManager.checkIsDiffApplicable(
            { path: relativeFilePath, incrementalUdiff: data.raw_diff },
            repoPath,
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

        case 'reload-window':
          this.reloadWindow();
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
    const authenticationManager = new AuthenticationManager(this.context, this.configManager);
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
          HOST: BINARY_DD_HOST,
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
          this.errorTrackingManager.trackGeneralError({
            error: err,
            errorType: 'BINARY_INIT_ERROR',
            errorSource: 'BINARY',
            repoPath: activeRepo,
          });
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
      await this.indexingService.updateVectorStore(params);
    } catch (error) {
      this.logger.warn('Embedding failed');
      this.outputChannel.warn('Embedding failed');
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'EMBEDDING_ERROR',
        errorSource: 'BINARY',
        repoPath: activeRepo,
      });
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
      await this.indexingService.updateVectorStore(params);
    } catch (error) {
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'RETRY_EMBEDDING_ERROR',
        errorSource: 'BINARY',
        repoPath: repoPath,
      });
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
      this.errorTrackingManager.trackGeneralError({
        error,
        errorType: 'OPEN_MCP_SETTINGS_ERROR',
        errorSource: 'EXTENSION',
      });
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

  async enhanceUserQuery(userQuery: string, sessionId?: number) {
    return await this.userQueryEnhancerService.generateEnhancedUserQuery(userQuery, sessionId);
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
    let response: any[] = [];
    try {
      response = await this.historyService.getPastSessionChats(sessionData.sessionId);
      setSessionId(sessionData.sessionId); // remove
      const formattedResponse = formatSessionChats(response);
      return formattedResponse;
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

  async reloadWindow() {
    vscode.window.showInformationMessage('Reloading window to apply changes...');
    vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  async createNewWorkspace(tool_use_id: string, chatId: string) {
    createNewWorkspaceFn(chatId, tool_use_id, this.context, this.outputChannel);
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

  public async handleCodeReviewPreProcess(data: { newReview: NewReview; reviewType: string }) {
    //TODO: Need to enable
    // const { get_url, key } = await this.codeReviewManager.uploadDiffToS3({ review_files_dif: data.file_wise_changes });
    // console.log('Diff uploaded to S3:', get_url, key);

    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'REVIEW_PRE_PROCESS_STARTED',
      data: {},
    });

    const preProcessPayload = {
      file_wise_diff: data.newReview.file_wise_changes,
      source_branch: data.newReview.source_branch,
      target_branch: data.newReview.target_branch,
      source_commit: data.newReview.source_commit,
      target_commit: data.newReview.target_commit,
      origin_url: data.newReview.origin_url,
      repo_name: data.newReview.repo_name,
      review_type: data.reviewType,
    };

    const preProcessResult = await this.reviewService.codeReviewPreProcess(preProcessPayload);
    if (preProcessResult.is_error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'REVIEW_PRE_PROCESS_FAILED',
        data: { error: preProcessResult.meta.message },
      });
    } else {
      const reviewId = preProcessResult.data.review_id;
      const reviewSessionId = preProcessResult.data.session_id;
      setReviewSessionId(reviewSessionId);
      setReviewId(reviewId);
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'REVIEW_PRE_PROCESS_COMPLETED',
        data: preProcessResult.data,
      });
    }
  }

  public async handleCodeReviewStart(data: any) {
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'REVIEW_STARTED',
      data: {},
    });

    const agentsPayload = data as { review_id: number; agents: AgentPayload[] };
    const repoPath = getActiveRepo();
    if (!repoPath) return;
    this.codeReviewManager.startCodeReview(agentsPayload, repoPath);
  }

  public async handleCodeReviewPostProcess(data: any) {
    this.codeReviewManager.startCodeReviewPostProcess(data);
  }

  public async newReview(data: any) {
    const result = await this.reviewService.newReview(data.targetBranch, data.reviewType);
    if (result && !result.is_error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'new-review-created',
        data: result.data,
      });
    } else {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'new-review-error',
        data: result.meta.message,
      });
    }
  }

  public async resetReview(data: any) {
    const result = await this.reviewService.resetReview(data.targetBranch, data.reviewType);
    if (result && !result.is_error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'review-reset-done',
        data: result.data,
      });
    } else {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'review-reset-error',
        data: result.meta.message,
      });
    }
  }

  public async searchBranches(keyword: string) {
    const result = await this.reviewService.searchBranch(keyword);
    if (result && !result.is_error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'search-branches-result',
        data: result.data,
      });
    } else {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'search-branches-error',
        data: { error: 'Failed to search branches' },
      });
    }
  }

  public async handleDiffForCodeReview(data: any) {
    await this.codeReviewDiffManager.openFileDiff(data.udiff, data.filePath, data.fileName);
  }

  public async handleSnapshot(data: any) {
    try {
      const snapshot = await this.reviewService.hitSnapshot(data.reviewType, data.targetBranch);
      if (snapshot && !snapshot.is_error) {
        this.sendMessageToSidebar({
          id: uuidv4(),
          command: 'snapshot-result',
          data: snapshot,
        });
      } else {
        this.sendMessageToSidebar({
          id: uuidv4(),
          command: 'snapshot-error',
          data: { error: 'Failed to fetch snapshot' },
        });
      }
    } catch (error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'snapshot-error',
        data: { error: String(error) },
      });
    }
  }

  public async fetchPastReviews(data: any) {
    try {
      const reviews = await this.reviewService.getPastReviews(data.sourceBranch, data.repoId);
      if (reviews && !reviews.is_error) {
        this.sendMessageToSidebar({
          id: uuidv4(),
          command: 'past-reviews',
          data: reviews.data,
        });
      } else {
        this.sendMessageToSidebar({
          id: uuidv4(),
          command: 'past-reviews-error',
          data: { error: 'Failed to fetch past reviews' },
        });
      }
    } catch (error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'past-reviews-error',
        data: { error: String(error) },
      });
    }
  }

  public async fetchUserAgents() {
    try {
      const userAgents = await this.reviewService.getUserAgents();
      if (userAgents && !userAgents.is_error) {
        this.sendMessageToSidebar({
          id: uuidv4(),
          command: 'user-agents',
          data: userAgents.data.agents,
        });
      } else {
        this.sendMessageToSidebar({
          id: uuidv4(),
          command: 'user-agents-error',
          data: { error: 'Failed to fetch user agents' },
        });
      }
    } catch (error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'user-agents-error',
        data: { error: String(error) },
      });
    }
  }

  public async userAgentCrud(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    agent_id?: number,
    agent_name?: string,
    custom_prompt?: string,
  ): Promise<any> {
    try {
      switch (operation) {
        case 'CREATE': {
          if (!agent_name || !custom_prompt) {
            return;
          }
          const agentCreationResponse = await this.reviewService.createAgent(agent_name, custom_prompt);
          if (agentCreationResponse.is_success) {
            this.fetchUserAgents();
          }
          break;
        }

        case 'UPDATE': {
          if (!agent_id || !custom_prompt) {
            return;
          }
          const agentUpdationResponse = await this.reviewService.updateAgent(agent_id, custom_prompt, agent_name);
          if (agentUpdationResponse.is_success) {
            this.fetchUserAgents();
          }
          break;
        }

        case 'DELETE': {
          if (!agent_id) {
            return;
          }
          const agentDeletionResponse = await this.reviewService.deleteAgent(agent_id);
          if (agentDeletionResponse.is_success) {
            this.fetchUserAgents();
            this.sendMessageToSidebar({
              id: uuidv4(),
              command: 'user-agent-deleted',
              data: { agent_id },
            });
          }
          break;
        }

        default:
          throw new Error(`Invalid operation: ${operation}`);
      }
    } catch (error) {
      this.sendMessageToSidebar({
        id: uuidv4(),
        command: 'user-agent-crud-error',
        data: { error: String(error) },
      });
    }
  }

  public reviewNotification(reviewStatus: string) {
    if (reviewStatus === 'REVIEW_COMPLETED') {
      vscode.window.showInformationMessage('Review completed successfully.');
    }
    if (reviewStatus === 'REVIEW_FAILED') {
      vscode.window.showErrorMessage('Review failed. Please try again.');
    }
  }

  public async getRepoDetailsForReview(data: any) {
    const repoDetails = await this.reviewService.getRepoDetails(data.repo_name, data.origin_url);
    this.sendMessageToSidebar({
      id: uuidv4(),
      command: 'repo-details-for-review-fetched',
      data: repoDetails.data,
    });
  }

  public async submitCommentFeedback(data: any) {
    if (data && data.commentId && (data.isLike === true || data.isLike === false)) {
      await this.reviewService.submitCommentFeedback(data.commentId, data.isLike);
    }

    if (data && data.commentId && (data.isLike === true || data.isLike === false) && data.feedbackComment) {
      await this.reviewService.submitCommentFeedback(data.commentId, data.isLike, data.feedbackComment);
    }
  }

  public async handleOpenCommentInFile(data: any) {
    // Comment box view event for usage tracking
    this.trackingManager.trackUsage({
      eventType: 'COMMENT_BOX_VIEW',
      eventData: {
        comment_id: data.commentId,
        source: 'IDE_CODE_REVIEW',
      },
    });

    this.commentHandler.showCommentAtLine(
      data.filePath,
      data.lineNumber,
      data.commentText,
      data.promptText,
      data.commentId,
    );
  }
  public onActionRequiredNotification(chatId: string, chatStatusMsg?: ChatStatusMsg, summary?: string) {
    // Define the custom message map
    const messageMap: Record<ChatStatusMsg, string> = {
      ask_user_input: 'Deputydev needs your input to continue.',
      terminal_approval: 'Deputydev is waiting for your approval to run a terminal command.',
      mcp_approval: 'Deputydev requires your approval for an MCP action.',
      model_change: 'Deputydev is requesting your confirmation to change the model.',
      create_new_workspace: 'Deputydev needs to create a new workspace to continue.',
    };

    // Use a strongly typed lookup
    const finalMessage =
      (chatStatusMsg ? messageMap[chatStatusMsg] : undefined) ?? 'Deputydev is requesting your intervention.'; // default fallback

    vscode.window.showInformationMessage(finalMessage, 'Open Chat').then((selection) => {
      if (selection === 'Open Chat') {
        this.sendMessageToSidebar({
          id: uuidv4(),
          command: 'focus-chat-and-open-action-required',
          data: chatId,
        });
        vscode.commands.executeCommand('deputydev-sidebar.focus');
      }
    });
  }
}
