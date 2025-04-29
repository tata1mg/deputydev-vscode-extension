// File: src/extension.ts

import * as vscode from "vscode";
import { DiffViewManager } from "./diff/DiffManager";
import { InlineDiffViewManager } from "./diff/InlineDiffManager";
import { DiffEditorViewManager } from "./diff/SideDiffManager";
import { SidebarProvider } from "./panels/SidebarProvider";
import { WorkspaceManager } from "./code_syncing/WorkspaceManager";
import { AuthenticationManager } from "./auth/AuthenticationManager";
import { ChatManager } from "./chat/ChatManager";
import { ReferenceManager } from "./references/ReferenceManager";
import { ConfigManager } from "./utilities/ConfigManager";
import {
  setExtensionContext,
  setSidebarProvider,
  clearWorkspaceStorage,
  deleteSessionId,
  getActiveRepo,
} from "./utilities/contextManager";
import { WebviewFocusListener } from "./code_syncing/WebviewFocusListener";
import { HistoryService } from "./services/history/HistoryService";
import { InlineChatEditManager } from "./inlineChatEdit/inlineChatEdit";
import { AuthService } from "./services/auth/AuthService";
import { UsageTrackingManager } from "./usageTracking/UsageTrackingManager";
import { ServerManager } from "./binaryUp/ServerManager";
import { getBinaryHost } from "./config";
import { binaryApi } from "./services/api/axios";
import { API_ENDPOINTS } from "./services/api/endpoints";
import { ProfileUiService } from "./services/profileUi/profileUiService";
import { BackgroundPinger } from "./binaryUp/BackgroundPinger";
import { createOutputChannel } from "./utilities/outputChannelFlag";
import { Logger } from "./utilities/Logger";
import { ThemeManager } from "./utilities/vscodeThemeManager";
import { isNotCompatible } from "./utilities/checkOsVersion";
import { FeedbackService } from "./services/feedback/feedbackService";
import { ContinueNewWorkspace } from "./terminal/workspace/ContinueNewWorkspace";
import { TerminalManager } from "./terminal/TerminalManager";
import { createNewWorkspaceFn } from "./terminal/workspace/CreateNewWorkspace";
import { UserQueryEnhancerService } from "./services/userQueryEnhancer/userQueryEnhancerService";
export async function activate(context: vscode.ExtensionContext) {
  const isNotCompatibleCheck = isNotCompatible();
  if (isNotCompatibleCheck) {
    return;
  }
  setExtensionContext(context);
  
  await clearWorkspaceStorage();
  const ENABLE_OUTPUT_CHANNEL = false;
  const outputChannel = createOutputChannel("DeputyDev", ENABLE_OUTPUT_CHANNEL);
  const logger = new Logger();




  // 2. Configuration Management
  const configManager = new ConfigManager(context, logger, outputChannel);
  await configManager.fetchAndStoreConfigEssentials();
  if (!(await configManager.getAllConfigEssentials())) {
    logger.error("Failed to fetch essential configuration. Aborting activation.");
    outputChannel.error("Failed to fetch essential configuration. Aborting activation.");
    vscode.window.showErrorMessage("DeputyDev failed to initialize: Could not load essential configuration.");
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
  const terminalManager = new TerminalManager(context)


  // 4. Diff View Manager Initialization
  const inlineDiffEnable = vscode.workspace
    .getConfiguration("deputydev")
    .get("inlineDiff.enable");

  let diffViewManager: DiffViewManager;
  if (inlineDiffEnable) {
    // inline diff view manager
    const inlineDiffViewManager = new InlineDiffViewManager(
      context,
      outputChannel
    );
    context.subscriptions.push(inlineDiffViewManager);
    diffViewManager = inlineDiffViewManager;
  } else {
    // diff editor diff manager
    const diffEditorDiffManager = new DiffEditorViewManager(
      context,
      outputChannel
    );
    context.subscriptions.push(diffEditorDiffManager);
    diffViewManager = diffEditorDiffManager;
  }

  const chatService = new ChatManager(context, outputChannel, diffViewManager, terminalManager);

  // //  * 3) Register Custom TextDocumentContentProvider
  // const diffContentProvider = new DiffContentProvider();
  // const providerReg = vscode.workspace.registerTextDocumentContentProvider(
  //   'my-diff-scheme',
  //   diffContentProvider
  // );
  // context.subscriptions.push(providerReg);


  const continueNewWorkspace = new ContinueNewWorkspace(context, outputChannel);
  await continueNewWorkspace.init();

  //  4) Register the Sidebar (webview)
  const sidebarProvider = new SidebarProvider(
    context,
    context.extensionUri,
    diffViewManager,
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
  );  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "deputydev-sidebar",
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // sidebarProvider.setViewType("loader");
  new ThemeManager(sidebarProvider, logger);

  const pinger = new BackgroundPinger(
    context,
    sidebarProvider,
    serverManager,
    outputChannel,
    logger,
    configManager
  );

  (async () => {
    // sidebarProvider.setViewType("loader");
    await serverManager.ensureBinaryExists();
    await serverManager.startServer();
    outputChannel.info("this binary host now is " + getBinaryHost());
    pinger.start();


    authenticationManager
      .validateCurrentSession()
      .then((status) => {
        outputChannel.info(`Authentication result: ${status}`);
        if (status) {
          configManager.fetchAndStoreConfig();
          sidebarProvider.initiateBinary();
          logger.info("User is authenticated.");
          outputChannel.info("User is authenticated.");
          sidebarProvider.sendMessageToSidebar("AUTHENTICATED");
          vscode.commands.executeCommand(
            "setContext",
            "deputydev.isAuthenticated",
            true
          );
          sidebarProvider.setViewType("chat");
        } else {
          logger.info("User is not authenticated.");
          outputChannel.info("User is not authenticated.");
          sidebarProvider.sendMessageToSidebar("NOT_AUTHENTICATED");
          sidebarProvider.setViewType("auth");
          vscode.commands.executeCommand(
            "setContext",
            "deputydev.isAuthenticated",
            false
          );
        }
      })
      .catch((error) => {
        logger.error(`Authentication failed, Please try again`);
        outputChannel.error(`Authentication failed: ${error}`);
        sidebarProvider.sendMessageToSidebar("NOT_AUTHENTICATED");
        sidebarProvider.setViewType("auth");
        vscode.commands.executeCommand(
          "setContext",
          "deputydev.isAuthenticated",
          false
        );
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
    sidebarProvider
  );
  inlineChatEditManager.inlineEdit();
  inlineChatEditManager.inlineChat();
  inlineChatEditManager.inlineChatEditQuickFixes();
  //  6) Register "closeApp" command
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.closeApp", () => {
      vscode.commands.executeCommand("workbench.action.closeWindow");
    })
  );

  const workspaceManager = new WorkspaceManager(
    context,
    sidebarProvider,
    outputChannel,
    configManager
  );

  new WebviewFocusListener(
    context,
    sidebarProvider,
    workspaceManager,
    outputChannel
  );

  const relevantPaths = workspaceManager.getWorkspaceRepos();




  // 7) Register commands for Accept/Reject etc
  //
  // Accept changes in the active file
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.acceptChanges", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          "No active editor to accept changes for."
        );
        return;
      }
      const fileUri = editor.document.uri;
      outputChannel.info(`Accepting changes for ${fileUri.fsPath}`);
      await diffViewManager.acceptFile(fileUri.fsPath);
      vscode.window.showInformationMessage("Changes accepted successfully.");
    })
  );

  // Reject changes in the active file
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.rejectChanges", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          "No active editor to reject changes for."
        );
        return;
      }
      const fileUri = editor.document.uri;
      outputChannel.info(`rejecting changes for ${fileUri.fsPath}`);
      await diffViewManager.rejectFile(fileUri.fsPath);
      vscode.window.showInformationMessage("Changes rejected successfully.");
    })
  );

  // If you want commands for accepting or rejecting ALL tracked files:
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.acceptAllChanges", async () => {
      outputChannel.info(`Accepting changes for all file`);
      await diffViewManager.acceptAllFile();
      vscode.window.showInformationMessage("All changes accepted.");
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.rejectAllChanges", async () => {
      await diffViewManager.rejectAllFile();
      vscode.window.showInformationMessage("All changes rejected.");
    })
  );

  // Command to open a diff view for any file path + new content
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "deputydev.openDiffView",
      async (path: string, content: string) => {
        if (!diffViewManager) {
          vscode.window.showErrorMessage(
            "Diff view manager is not initialized."
          );
          return;
        }
        try {
          await diffViewManager.openDiffView({ path, content });
          vscode.window.showInformationMessage(`Diff view opened for ${path}`);
        } catch (error) {
          outputChannel.error(`Failed to open diff view: ${error}`);
          vscode.window.showErrorMessage("Failed to open diff view.");
        }
      }
    )
  );

  // add button click
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.AddButtonClick", () => {
      chatService.stopChat(), outputChannel.info("Add button clicked!");
      sidebarProvider.newChat();
    })
  );

  // profile button click
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.UserProfile", () => {
      outputChannel.info("Profile button clicked!");
      sidebarProvider.setViewType("profile");
    })
  );

  // history button click
  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.HistoryButtonClick", () => {
      outputChannel.info("Setting button clicked!");
      sidebarProvider.setViewType("history");
    })
  );


	context.subscriptions.push(
		vscode.commands.registerCommand("deputydev.addTerminalOutputToChat", async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				return
			}

			// Save current clipboard content
			const tempCopyBuffer = await vscode.env.clipboard.readText()

			try {
				// Copy the *existing* terminal selection (without selecting all)
				await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

				// Get copied content
				let terminalContents = (await vscode.env.clipboard.readText()).trim()

				// Restore original clipboard content
				await vscode.env.clipboard.writeText(tempCopyBuffer)

				if (!terminalContents) {
					// No terminal content was copied (either nothing selected or some error)
					return
				}

				// Send to sidebar provider
				sidebarProvider.addSelectedTerminalOutputToChat(terminalContents)
			} catch (error) {
				// Ensure clipboard is restored even if an error occurs
				await vscode.env.clipboard.writeText(tempCopyBuffer)
        logger.error("Failed to get terminal contents", error)
				vscode.window.showErrorMessage("Failed to get terminal contents")
			}
		}),
	)

  context.subscriptions.push(
    vscode.commands.registerCommand("deputydev.ViewLogs", () => {
      logger.showCurrentProcessLogs();
    })
  );

  outputChannel.info(
    `these are the repos stored in the workspace ${JSON.stringify(context.workspaceState.get("workspace-storage"))}`
  );


}

export async function deactivate() {
  await binaryApi().get(API_ENDPOINTS.SHUTDOWN);
  deleteSessionId();
}
