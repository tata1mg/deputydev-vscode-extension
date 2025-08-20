import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { AuthenticationManager } from './auth/AuthenticationManager';
import { BackgroundPinger } from './binaryUp/BackgroundPinger';
import { ServerManager } from './binaryUp/ServerManager';
import { ChatManager } from './chat/ChatManager';
import { WorkspaceManager } from './code_syncing/WorkspaceManager';
import { ENABLE_OUTPUT_CHANNEL, getBinaryHost, getBinaryWsHost } from './config';
import { DiffManager } from './diff/diffManager';
import { InlineChatEditManager } from './inlineChatEdit/inlineChatEdit';
import { SidebarProvider } from './panels/SidebarProvider';
import { ReferenceManager } from './references/ReferenceManager';
import { AuthService } from './services/auth/AuthService';
import { HistoryService } from './services/history/HistoryService';
import { ProfileUiService } from './services/profileUi/profileUiService';
import { UsageTrackingManager } from './analyticsTracking/UsageTrackingManager';
import { ErrorTrackingManager } from './analyticsTracking/ErrorTrackingManager';
import { checkIfExtensionIsCompatible } from './utilities/checkOsVersion';
import { ConfigManager } from './utilities/ConfigManager';
import {
  clearWorkspaceStorage,
  deleteSessionId,
  sendNotVerified,
  sendVerified,
  setExtensionContext,
  setSidebarProvider,
} from './utilities/contextManager';
import { SingletonLogger } from './utilities/Singleton-logger';
import { createOutputChannel } from './utilities/outputChannelFlag';
import { ThemeManager } from './utilities/vscodeThemeManager';

import * as os from 'os';
import * as path from 'path';
import { TextDocument } from 'vscode';
import { watchMcpFileSave } from './code_syncing/mcpSettingsSync';
import { MCPManager } from './mcp/mcpManager';
import { ApiErrorHandler } from './services/api/apiErrorHandler';
import { TerminalRegistry } from './terminal/TerminalRegistry';
import { FeedbackService } from './services/feedback/feedbackService';
import { MCPService } from './services/mcp/mcpService';
import { UserQueryEnhancerService } from './services/userQueryEnhancer/userQueryEnhancerService';
import { ContinueNewWorkspace } from './terminal/workspace/ContinueNewWorkspace';
import { updateTerminalSettings } from './utilities/setDefaultSettings';
import { API_ENDPOINTS } from './services/api/endpoints';
import { binaryApi } from './services/api/axios';
import { ActiveFileListener } from './code_syncing/ActiveFileListener';
import { BackendClient } from './clients/backendClient';
import { BinaryClient } from './clients/binaryClient';
import { IndexingService } from './services/indexing/indexingService';
import { RelevantCodeSearcherToolService } from './services/tools/relevantCodeSearcherTool/relevantCodeSearcherToolServivce';
import { setUserSystemData } from './utilities/getSystemInformation';
import { ReviewService } from './services/codeReview/CodeReviewService';
import { CodeReviewDiffManager } from './diff/codeReviewDiff/codeReviewDiffManager';
import { CommentHandler } from './codeReview/CommentHandler';
import { CodeReviewManager } from './codeReviewManager/CodeReviewManager';
import { closeDeputyDevDebugTabs } from './utilities/closeOpenedLogs';
import { getSendMessageToSidebarDetail } from './chat/test';
import { GetUsagesTool } from './chat/tools/usages/GetUsageTool';

export async function activate(context: vscode.ExtensionContext) {
  const isCompatible = checkIfExtensionIsCompatible();
  if (!isCompatible) {
    // If extension is not compatible, stop activation
    return;
  }

  closeDeputyDevDebugTabs();
  setExtensionContext(context);
  setUserSystemData(context);
  await clearWorkspaceStorage();
  await updateTerminalSettings(context);

  const outputChannel = createOutputChannel('DeputyDev', ENABLE_OUTPUT_CHANNEL);
  const logger = SingletonLogger.getInstance();

  // 2. Configuration Management
  const configManager = new ConfigManager(context, outputChannel);
  await configManager.fetchAndStoreConfigEssentials();
  if (!(await configManager.getAllConfigEssentials())) {
    logger.error('Failed to fetch essential configuration. Aborting activation.');
    outputChannel.error('Failed to fetch essential configuration. Aborting activation.');
    vscode.window.showErrorMessage('DeputyDev failed to initialize: Could not load essential configuration.');
    return;
  }

  logger.info(`Extension "DeputyDev" is now active!`);
  outputChannel.info('Extension "DeputyDev" is now active!');

  // 3. Core Services Initialization
  const serverManager = new ServerManager(context, outputChannel, configManager);

  // initialize backend client with essential config
  const essentialConfigs = configManager.getAllConfigEssentials();
  const backendClient = new BackendClient(
    essentialConfigs['HOST_AND_TIMEOUT']['HOST'],
    essentialConfigs['DD_HOST_WS'],
    {
      QUERY_SOLVER: essentialConfigs['QUERY_SOLVER_ENDPOINT'],
      REVIEW_SOLVER: essentialConfigs['REVIEW_SOLVER_ENDPOINT'],
      POST_PROCESS_SOLVER: essentialConfigs['REVIEW_POST_PROCESS_SOLVER_ENDPOINT'],
    },
  );

  const authenticationManager = new AuthenticationManager(context, configManager);
  const authService = new AuthService();
  const historyService = new HistoryService();
  const profileService = new ProfileUiService();
  const usageTrackingManager = new UsageTrackingManager(context, outputChannel);
  const errorTrackingManager = new ErrorTrackingManager();
  const referenceService = new ReferenceManager(context, outputChannel);
  const feedBackService = new FeedbackService();
  const userQueryEnhancerService = new UserQueryEnhancerService(errorTrackingManager);
  const apiErrorHandler = new ApiErrorHandler();
  const mcpService = new MCPService();
  const indexingService = new IndexingService();
  const relevantCodeSearcherToolService = new RelevantCodeSearcherToolService();
  const reviewService = new ReviewService();
  const codeReviewDiffManager = new CodeReviewDiffManager();
  const commentHandler = new CommentHandler(context);

  const pathToDDFolderChangeProposerFile = path.join(os.homedir(), '.deputydev', 'current_change_proposer_state.txt');
  const diffManager = new DiffManager(context, pathToDDFolderChangeProposerFile, outputChannel, authService);
  await diffManager.init();

  const mcpManager = new MCPManager(outputChannel);

  // Initialize terminal shell execution handlers.
  TerminalRegistry.initialize();
  const chatService = new ChatManager(
    context,
    outputChannel,
    diffManager,
    apiErrorHandler,
    mcpManager,
    usageTrackingManager,
    errorTrackingManager,
    backendClient,
    relevantCodeSearcherToolService,
  );

  const continueNewWorkspace = new ContinueNewWorkspace(context, outputChannel);
  await continueNewWorkspace.init();

  const codeReviewManager = new CodeReviewManager(context, outputChannel, backendClient, apiErrorHandler);

  //  4) Register the Sidebar (webview)
  const sidebarProvider = new SidebarProvider(
    context,
    context.extensionUri,
    diffManager,
    outputChannel,
    chatService,
    historyService,
    authService,
    referenceService,
    configManager,
    profileService,
    usageTrackingManager,
    feedBackService,
    userQueryEnhancerService,
    errorTrackingManager,
    continueNewWorkspace,
    indexingService,
    reviewService,
    codeReviewDiffManager,
    commentHandler,
    codeReviewManager,
  );

  diffManager.setSidebarProvider(sidebarProvider);
  codeReviewManager.setSidebarProvider(sidebarProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('deputydev-sidebar', sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    sidebarProvider,
  );
  const workspaceManager = new WorkspaceManager(
    context,
    sidebarProvider,
    outputChannel,
    configManager,
    indexingService,
  );
  // sidebarProvider.setViewType("loader");
  new ThemeManager(sidebarProvider);
  new ActiveFileListener(sidebarProvider, workspaceManager);

  const pinger = new BackgroundPinger(
    context,
    sidebarProvider,
    serverManager,
    outputChannel,
    configManager,
    authenticationManager,
    indexingService,
    relevantCodeSearcherToolService,
  );
  context.subscriptions.push(pinger);
  (async () => {
    await serverManager.ensureBinaryExists();
    await serverManager.startServer();
    outputChannel.info('this binary host now is ' + getBinaryHost());

    const binaryClient = new BinaryClient(
      getBinaryHost(), // This will be the binary host URL
      getBinaryWsHost(), // This will be the binary WebSocket host URL
    );
    indexingService.init(binaryClient);
    relevantCodeSearcherToolService.init(binaryClient);

    pinger.start();

    authenticationManager
      .validateCurrentSession()
      .then((status) => {
        outputChannel.info(`Authentication result: ${status}`);
        if (status) {
          configManager.fetchAndStoreConfig();
          sidebarProvider.initiateBinary();
          sendVerified();
          logger.info('User is authenticated.');
        } else {
          logger.info('User is not authenticated.');
          sendNotVerified();
        }
      })
      .catch((error) => {
        logger.error(`Authentication failed, Please try again`);
        outputChannel.error(`Authentication failed: ${error}`);
        sendNotVerified();
      });
  })();

  chatService.setSidebarProvider(sidebarProvider);
  setSidebarProvider(sidebarProvider);
  // authenticationManager.setSidebarProvider(sidebarProvider);

  watchMcpFileSave(context, async (document: TextDocument) => {
    const response = await mcpService.syncServers();
    if (response && response.data && !response.is_error) {
      sidebarProvider.sendMessageToSidebar({
        id: uuidv4(),
        command: 'fetched-mcp-servers',
        data: response.data,
      });
    }
    vscode.window.showInformationMessage(`MCP settings saved and synced successfully`);
  });

  const inlineChatEditManager = new InlineChatEditManager(
    context,
    outputChannel,
    chatService,
    sidebarProvider,
    diffManager,
    usageTrackingManager,
    errorTrackingManager,
    relevantCodeSearcherToolService,
  );
  inlineChatEditManager.inlineEdit();
  inlineChatEditManager.inlineChat();
  inlineChatEditManager.inlineChatEditQuickFixes();
  //  6) Register "closeApp" command
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.closeApp', () => {
      vscode.commands.executeCommand('workbench.action.closeWindow');
    }),
  );

  // Code review button click
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.OpenCodeReview', () => {
      sidebarProvider.setViewType('code-review');
    }),
  );

  // add button click
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.AddButtonClick', () => {
      chatService.stopChat();
      outputChannel.info('Add button clicked!');
      sidebarProvider.newChat();
    }),
  );

  // profile button click
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.UserProfile', () => {
      outputChannel.info('Profile button clicked!');
      sidebarProvider.setViewType('profile');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.ViewFAQ', () => {
      outputChannel.info('FAQ View Selected!');
      sidebarProvider.setViewType('faq');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.ViewHelp', () => {
      outputChannel.info('Help View Selected!');
      sidebarProvider.setViewType('help');
    }),
  );

  // history button click
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.HistoryButtonClick', () => {
      outputChannel.info('History button clicked!');
      sidebarProvider.setViewType('history');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.SettingsButtonClick', () => {
      outputChannel.info('Settings button clicked!');
      sidebarProvider.setViewType('setting');
    }),
  );

  // Code review
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.resolveComment', async (thread: vscode.CommentThread) => {
      // Handle resolveComment action
      const commentId = commentHandler.getCommentIdFromThread(thread);

      if (commentId !== undefined) {
        commentHandler.closeThread(thread);

        const result = await reviewService.updateCommentStatus(commentId, 'RESOLVED');
        if (result.is_success) {
          sidebarProvider.sendMessageToSidebar({
            id: uuidv4(),
            command: 'comment-is-resolved',
            data: commentId,
          });
        }
      }
    }),

    vscode.commands.registerCommand('deputydev.fixWithDeputyDev', async (thread: vscode.CommentThread) => {
      // Get the comment ID using the thread
      const commentId = commentHandler.getCommentIdFromThread(thread);

      // Now you can use the commentId for your fix logic
      if (commentId !== undefined) {
        // Fix With DD usage tracking
        const fixWithDDUsageTrackingPayload = {
          eventType: 'FIX_WITH_DD',
          eventData: {
            comment_id: commentId,
            source: 'IDE_CODE_REVIEW',
          },
        };
        await usageTrackingManager.trackUsage(fixWithDDUsageTrackingPayload);

        const commentFixQuery = await reviewService.getCommentFixQuery(commentId);

        if (commentFixQuery?.is_success) {
          sidebarProvider.sendMessageToSidebar({
            id: uuidv4(),
            command: 'fix-with-dd',
            data: commentFixQuery.data,
          });
        }
      }
    }),

    vscode.commands.registerCommand('deputydev.ignoreComment', async (thread: vscode.CommentThread) => {
      const commentId = commentHandler.getCommentIdFromThread(thread);

      if (commentId !== undefined) {
        commentHandler.closeThread(thread);
        const result = await reviewService.updateCommentStatus(commentId, 'REJECTED');
        if (result.is_success) {
          sidebarProvider.sendMessageToSidebar({
            id: uuidv4(),
            command: 'comment-is-ignored',
            data: commentId,
          });
        }
      }
    }),

    vscode.commands.registerCommand('deputydev.collapseAllComments', () => {
      commentHandler.closeAllThreads();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.addTerminalOutputToChat', async () => {
      const terminal = vscode.window.activeTerminal;
      if (!terminal) {
        return;
      }

      // Save current clipboard content
      const tempCopyBuffer = await vscode.env.clipboard.readText();

      try {
        // Copy the *existing* terminal selection (without selecting all)
        await vscode.commands.executeCommand('workbench.action.terminal.copySelection');

        // Get copied content
        const terminalContents = (await vscode.env.clipboard.readText()).trim();

        // Restore original clipboard content
        await vscode.env.clipboard.writeText(tempCopyBuffer);

        if (!terminalContents) {
          // No terminal content was copied (either nothing selected or some error)
          return;
        }

        // Send to sidebar provider
        sidebarProvider.addSelectedTerminalOutputToChat(terminalContents);
      } catch (error) {
        // Ensure clipboard is restored even if an error occurs
        await vscode.env.clipboard.writeText(tempCopyBuffer);
        logger.error('Failed to get terminal contents', error);
        vscode.window.showErrorMessage('Failed to get terminal contents');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.ViewLogs', () => {
      logger.showCurrentProcessLogs();
    }),
  );

  outputChannel.info(
    `these are the repos stored in the workspace ${JSON.stringify(context.workspaceState.get('workspace-storage'))}`,
  );
}

export async function deactivate() {
  await binaryApi().get(API_ENDPOINTS.SHUTDOWN);
  TerminalRegistry.cleanup();
  deleteSessionId();
}
