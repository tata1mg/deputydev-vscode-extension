import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { AuthenticationManager } from './auth/AuthenticationManager';
import { BackgroundPinger } from './binaryUp/BackgroundPinger';
import { ServerManager } from './binaryUp/ServerManager';
import { ChatManager } from './chat/ChatManager';
import { WebviewFocusListener } from './code_syncing/WebviewFocusListener';
import { WorkspaceManager } from './code_syncing/WorkspaceManager';
import { getBinaryHost } from './config';
import { DiffManager } from './diff/diffManager';
import { InlineChatEditManager } from './inlineChatEdit/inlineChatEdit';
import { SidebarProvider } from './panels/SidebarProvider';
import { ReferenceManager } from './references/ReferenceManager';
import { AuthService } from './services/auth/AuthService';
import { HistoryService } from './services/history/HistoryService';
import { ProfileUiService } from './services/profileUi/profileUiService';
import { UsageTrackingManager } from './usageTracking/UsageTrackingManager';
import { isNotCompatible } from './utilities/checkOsVersion';
import { ConfigManager } from './utilities/ConfigManager';
import {
  clearWorkspaceStorage,
  deleteSessionId,
  setExtensionContext,
  setSidebarProvider,
} from './utilities/contextManager';
import { Logger } from './utilities/Logger';
import { createOutputChannel } from './utilities/outputChannelFlag';
import { ThemeManager } from './utilities/vscodeThemeManager';

import * as os from 'os';
import * as path from 'path';
import { TextDocument } from 'vscode';
import { watchMcpFileSave } from './code_syncing/mcpSettingsSync';
import { ApiErrorHandler } from './services/api/apiErrorHandler';
import { FeedbackService } from './services/feedback/feedbackService';
import { MCPService } from './services/mcp/mcpService';
import { UserQueryEnhancerService } from './services/userQueryEnhancer/userQueryEnhancerService';
import { TerminalManager } from './terminal/TerminalManager';
import { ContinueNewWorkspace } from './terminal/workspace/ContinueNewWorkspace';
import { updateTerminalSettings } from './utilities/setDefaultSettings';

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
  const mcpService = new MCPService();

  // 4. Diff View Manager Initialization
  const inlineDiffEnable = vscode.workspace.getConfiguration('deputydev').get('inlineDiff.enable');

  const pathToDDFolderChangeProposerFile = path.join(os.homedir(), '.deputydev', 'current_change_proposer_state.txt');
  const diffManager = new DiffManager(context, pathToDDFolderChangeProposerFile, outputChannel, authService);
  await diffManager.init();

  const mcpManager = new MCPManager();
  const chatService = new ChatManager(
    context,
    outputChannel,
    diffManager,
    terminalManager,
    apiErrorHandler,
    mcpManager,
  );

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

    await mcpService.syncServers().then((response) => {
      console.log('************on activating********', response);
      if (response.is_error) {
        vscode.window.showInformationMessage(response.data);
      }
      if (response && response.data && !response.is_error) {
        sidebarProvider.sendMessageToSidebar({
          id: uuidv4(),
          command: 'fetched-mcp-servers',
          data: response.data,
        });
        vscode.window.showInformationMessage('MCP servers synced successfully.');
      }
    });

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

  watchMcpFileSave(context, async (document: TextDocument) => {
    const response = await mcpService.syncServers();
    console.log('************on saving file********', response);
    if (response && response.data && !response.is_error) {
      sidebarProvider.sendMessageToSidebar({
        id: uuidv4(),
        command: 'fetched-mcp-servers',
        data: response.data,
      });
    }
    vscode.window.showInformationMessage(`MCP settings saved and synced successfully: ${document.uri.fsPath}`);
  });

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
  // await binaryApi().get(API_ENDPOINTS.SHUTDOWN);
  deleteSessionId();
}
