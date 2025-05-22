import * as vscode from 'vscode';
import { SidebarProvider } from './panels/SidebarProvider';
import { WorkspaceManager } from './code_syncing/WorkspaceManager';
import { AuthenticationManager } from './auth/AuthenticationManager';
import { ChatManager } from './chat/ChatManager';
import { ReferenceManager } from './references/ReferenceManager';
import { ConfigManager } from './utilities/ConfigManager';
import {
  setExtensionContext,
  setSidebarProvider,
  clearWorkspaceStorage,
  deleteSessionId,
} from './utilities/contextManager';
import { WebviewFocusListener } from './code_syncing/WebviewFocusListener';
import { HistoryService } from './services/history/HistoryService';
import { InlineChatEditManager } from './inlineChatEdit/inlineChatEdit';
import { AuthService } from './services/auth/AuthService';
import { UsageTrackingManager } from './usageTracking/UsageTrackingManager';
import { ServerManager } from './binaryUp/ServerManager';
import { getBinaryHost } from './config';
import { ProfileUiService } from './services/profileUi/profileUiService';
import { BackgroundPinger } from './binaryUp/BackgroundPinger';
import { createOutputChannel } from './utilities/outputChannelFlag';
import { Logger } from './utilities/Logger';
import { ThemeManager } from './utilities/vscodeThemeManager';
import { isNotCompatible } from './utilities/checkOsVersion';
import { DiffManager } from './diff/diffManager';

import { FeedbackService } from './services/feedback/feedbackService';
import { ContinueNewWorkspace } from './terminal/workspace/ContinueNewWorkspace';
import { TerminalManager } from './terminal/TerminalManager';
import { UserQueryEnhancerService } from './services/userQueryEnhancer/userQueryEnhancerService';
import { updateTerminalSettings } from './utilities/setDefaultSettings';
import { binaryApi } from './services/api/axios';
import { API_ENDPOINTS } from './services/api/endpoints';
import { ApiErrorHandler } from './services/api/apiErrorHandler';
import * as path from 'path';
import * as os from 'os';

export async function activate(context: vscode.ExtensionContext) {
  const isNotCompatibleCheck = isNotCompatible();
  if (isNotCompatibleCheck) {
    return;
  }
  setExtensionContext(context);

  await clearWorkspaceStorage();
  await updateTerminalSettings(context);
  const ENABLE_OUTPUT_CHANNEL = false;
  const outputChannel = createOutputChannel('DeputyDev', ENABLE_OUTPUT_CHANNEL);
  const logger = new Logger();

  // 2. Configuration Management
  const configManager = new ConfigManager(context, logger, outputChannel);
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
  const serverManager = new ServerManager(context, outputChannel, logger, configManager);
  const authenticationManager = new AuthenticationManager(context, configManager, logger);
  const authService = new AuthService();
  const historyService = new HistoryService();
  const profileService = new ProfileUiService();
  const usageTrackingManager = new UsageTrackingManager(context, outputChannel);
  const referenceService = new ReferenceManager(context, outputChannel);
  const feedBackService = new FeedbackService();
  const userQueryEnhancerService = new UserQueryEnhancerService();
  const terminalManager = new TerminalManager(context);
  const apiErrorHandler = new ApiErrorHandler();

  // 4. Diff View Manager Initialization
  const inlineDiffEnable = vscode.workspace.getConfiguration('deputydev').get('inlineDiff.enable');

  const pathToDDFolderChangeProposerFile = path.join(os.homedir(), '.deputydev', 'current_change_proposer_state.txt');
  const diffManager = new DiffManager(context, pathToDDFolderChangeProposerFile, outputChannel, authService);
  await diffManager.init();
  const chatService = new ChatManager(context, outputChannel, diffManager, terminalManager, apiErrorHandler);

  const continueNewWorkspace = new ContinueNewWorkspace(context, outputChannel);
  await continueNewWorkspace.init();

  //  4) Register the Sidebar (webview)
  const sidebarProvider = new SidebarProvider(
    context,
    context.extensionUri,
    diffManager,
    outputChannel,
    logger,
    chatService,
    historyService,
    authService,
    referenceService,
    configManager,
    profileService,
    usageTrackingManager,
    feedBackService,
    userQueryEnhancerService,
    continueNewWorkspace,
    terminalManager,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('deputydev-sidebar', sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // sidebarProvider.setViewType("loader");
  new ThemeManager(sidebarProvider, logger);

  const pinger = new BackgroundPinger(context, sidebarProvider, serverManager, outputChannel, logger, configManager);

  (async () => {
    // sidebarProvider.setViewType("loader");
    await serverManager.ensureBinaryExists();
    await serverManager.startServer();
    outputChannel.info('this binary host now is ' + getBinaryHost());
    pinger.start();

    authenticationManager
      .validateCurrentSession()
      .then((status) => {
        outputChannel.info(`Authentication result: ${status}`);
        if (status) {
          configManager.fetchAndStoreConfig();
          sidebarProvider.initiateBinary();
          logger.info('User is authenticated.');
          outputChannel.info('User is authenticated.');
          sidebarProvider.sendMessageToSidebar('AUTHENTICATED');
          vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', true);
          sidebarProvider.setViewType('chat');
        } else {
          logger.info('User is not authenticated.');
          outputChannel.info('User is not authenticated.');
          sidebarProvider.sendMessageToSidebar('NOT_AUTHENTICATED');
          sidebarProvider.setViewType('auth');
          vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', false);
        }
      })
      .catch((error) => {
        logger.error(`Authentication failed, Please try again`);
        outputChannel.error(`Authentication failed: ${error}`);
        sidebarProvider.sendMessageToSidebar('NOT_AUTHENTICATED');
        sidebarProvider.setViewType('auth');
        vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', false);
      });
  })();

  chatService.setSidebarProvider(sidebarProvider);
  setSidebarProvider(sidebarProvider);
  // authenticationManager.setSidebarProvider(sidebarProvider);

  const inlineChatEditManager = new InlineChatEditManager(
    context,
    outputChannel,
    logger,
    chatService,
    sidebarProvider,
    diffManager,
    usageTrackingManager,
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

  const workspaceManager = new WorkspaceManager(context, sidebarProvider, outputChannel, configManager);

  new WebviewFocusListener(context, sidebarProvider, workspaceManager, outputChannel);

  const relevantPaths = workspaceManager.getWorkspaceRepos();

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
  deleteSessionId();
}
