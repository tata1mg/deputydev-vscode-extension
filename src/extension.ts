// File: src/extension.ts

import * as vscode from "vscode";
import * as os from "os";
import { DiffViewManager } from "./diff/DiffManager";
import { InlineDiffViewManager } from "./diff/InlineDiffManager"; //inline diff manager
import { DiffEditorViewManager } from "./diff/SideDiffManager"; // side-by-side diff manager
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
} from "./utilities/contextManager";
import { WebviewFocusListener } from "./code_syncing/WebviewFocusListener";
import { deleteSessionId } from "./utilities/contextManager";
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
export async function activate(context: vscode.ExtensionContext) {
  // if playform is windows then return and error
  if (os.platform() === "win32") {
    vscode.window.showWarningMessage(
      "Windows support coming soon! DeputyDev is currently MacOS-only, but we're working hard to expand. Stay tuned!"
    );
    return;
  }

  // context reset from past session
  setExtensionContext(context);
  await clearWorkspaceStorage();
  const ENABLE_OUTPUT_CHANNEL = false;
  const outputChannel = createOutputChannel("DeputyDev", ENABLE_OUTPUT_CHANNEL);
  const logger = new Logger();



  // // 0) Fetch and store essential config data
  const configManager = new ConfigManager(context, logger, outputChannel);
  await configManager.fetchAndStoreConfigEssentials();
  if (await !configManager.getAllConfigEssentials()) {
    return;
  }

  logger.info(`Extension "DeputyDev" is now active!`);
  outputChannel.info('Extension "DeputyDev" is now active!');
  const config = configManager.getAllConfigEssentials();
  // outputChannel.info(`Essential Config: ${JSON.stringify(config)}`);

  // 0.1 download and executes binary
  const serverManager = new ServerManager(
    context,
    outputChannel,
    logger,
    configManager
  );
  // await serverManager.ensureBinaryExists();
  // await serverManager.startServer();

  // 1) Authentication Flow
  const authenticationManager = new AuthenticationManager(
    context,
    configManager,
    logger
  );

  //  2) Choose & Initialize a Diff View Manager
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

  const referenceService = new ReferenceManager(context, outputChannel);
  const chatService = new ChatManager(context, outputChannel, diffViewManager);
  const usageTrackingManager = new UsageTrackingManager(context, outputChannel);

  const historyService = new HistoryService();
  const authService = new AuthService();
  const profileService = new ProfileUiService();

  // //  * 3) Register Custom TextDocumentContentProvider
  // const diffContentProvider = new DiffContentProvider();
  // const providerReg = vscode.workspace.registerTextDocumentContentProvider(
  //   'my-diff-scheme',
  //   diffContentProvider
  // );
  // context.subscriptions.push(providerReg);

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
    usageTrackingManager
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
  outputChannel.info(
    `these are the repos stored in the workspace ${JSON.stringify(context.workspaceState.get("workspace-storage"))}`
  );
  outputChannel.info(
    `these are the repos stored in the workspace ${JSON.stringify(context.workspaceState.get("workspace-storage"))}`
  );

  //  8) Show the output channel if needed & start server

  // chatService.start();
}

export async function deactivate() {
  await binaryApi().get(API_ENDPOINTS.SHUTDOWN);
  deleteSessionId();
}
