// File: src/extension.ts

import * as vscode from 'vscode';
import { DiffViewManager } from './diff/DiffManager';
import { InlineDiffViewManager } from './diff/InlineDiffManager'; //inline diff manager
import { DiffEditorViewManager } from './diff/SideDiffManager'; // side-by-side diff manager
import { registerCodeEditorMenuCommand } from './panels/CodeEditorMenu';
import { SidebarProvider } from './panels/SidebarProvider';
import { WorkspaceManager } from './code_syncing/WorkspaceManager';
import { AuthenticationManager } from './auth/AuthenticationManager';
import { ChatManager } from './chat/ChatManager';
import { ReferenceManager } from './references/ReferenceManager';
import   ConfigManager   from './utilities/ConfigManager';
import { setExtensionContext } from './utilities/contextManager';
import { WebviewFocusListener } from './code_syncing/WebviewFocusListener';
import {deleteSessionId} from './utilities/contextManager';
import { HistoryService } from './services/history/HistoryService';
import { InlineEditManager } from './edit/inlineEdit';
import { AuthService } from './services/auth/AuthService';
let outputChannel: vscode.LogOutputChannel;


export function activate(context: vscode.ExtensionContext) {
  const outputChannelName = vscode.workspace
    .getConfiguration('deputydev')
    .get<string>('outputChannelName', 'DeputyDev'); // Default to 'DeputyDev'

  outputChannel = vscode.window.createOutputChannel(outputChannelName, { log: true });
  setExtensionContext(context,outputChannel);
  deleteSessionId();

  outputChannel.info('Extension "DeputyDev" is now active!');
  const configManager = ConfigManager;


  // 1) Authentication Flow
  const authenticationManager = new AuthenticationManager(context);
  authenticationManager.validateCurrentSession().then((status) => {
    outputChannel.info(`Authentication result: ${status}`);
    if (status) {
      outputChannel.info('User is authenticated.');
      sidebarProvider.sendMessageToSidebar('AUTHENTICATED')
      sidebarProvider.setViewType("chat")
    } else {
      outputChannel.info('User is not authenticated.');
      sidebarProvider.sendMessageToSidebar('NOT_AUTHENTICATED')
      sidebarProvider.setViewType("auth")
    }
  }).catch((error) => {
    outputChannel.error(`Authentication failed: ${error}`);
    sidebarProvider.sendMessageToSidebar('NOT_AUTHENTICATED')
    // sidebarProvider.setViewType("auth")
    sidebarProvider.setViewType("chat")

  })

  //  2) Choose & Initialize a Diff View Manager
  const inlineDiffEnable = vscode.workspace
    .getConfiguration('deputydev')
    .get('inlineDiff.enable');

  let diffViewManager: DiffViewManager;
  if (inlineDiffEnable) {
    // inline diff view manager
    const inlineDiffViewManager = new InlineDiffViewManager(
      context,
      outputChannel,
    );
    context.subscriptions.push(inlineDiffViewManager);
    diffViewManager = inlineDiffViewManager;
  } else {
    // diff editor diff manager
    const diffEditorDiffManager = new DiffEditorViewManager(
      context,
      outputChannel,
    );
    context.subscriptions.push(diffEditorDiffManager);
    diffViewManager = diffEditorDiffManager;
  }

  const referenceService = new ReferenceManager(context, outputChannel);
  const chatService = new ChatManager(context, outputChannel, diffViewManager);
  const inlineEditManager = new InlineEditManager(context, outputChannel, chatService);
  inlineEditManager.editThisCode();
  inlineEditManager.codeLenseForInlineEdit();

  const historyService = new HistoryService();
  const authService = new AuthService();


  // //  * 3) Register Custom TextDocumentContentProvider
  // const diffContentProvider = new DiffContentProvider();
  // const providerReg = vscode.workspace.registerTextDocumentContentProvider(
  //   'my-diff-scheme',
  //   diffContentProvider
  // );
  // context.subscriptions.push(providerReg);

  //  4) Register the Sidebar (webview)
  const sidebarProvider = new SidebarProvider(context, context.extensionUri, diffViewManager, outputChannel, chatService, historyService, authService, referenceService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('deputydev-sidebar', sidebarProvider, { webviewOptions: { retainContextWhenHidden: true } })
  );

  //  * 5) Example: Register a code editor context command  (might remove it)
  registerCodeEditorMenuCommand(context, sidebarProvider);

  chatService.setSidebarProvider(sidebarProvider);




  // const fileWatcher = new FileWatcher(outputChannel);
  // context.subscriptions.push(fileWatcher);



  //  6) Register "closeApp" command
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.closeApp', () => {
      vscode.commands.executeCommand('workbench.action.closeWindow');
    })
  );



  const workspaceManager = new WorkspaceManager(context, sidebarProvider, outputChannel);



  const webviewFocusListener = new WebviewFocusListener(context, sidebarProvider, workspaceManager, outputChannel);

  // const relevantPaths = workspaceManager.getWorkspaceRepos();


  //   7) Register commands for Accept/Reject etc

  // Accept changes in the active file
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('deputydev.acceptChanges', async () => {
  //     const editor = vscode.window.activeTextEditor;
  //     if (!editor) {
  //       vscode.window.showErrorMessage('No active editor to accept changes for.');
  //       return;
  //     }
  //     const fileUri = editor.document.uri;
  //     outputChannel.info(`Accepting changes for ${fileUri.fsPath}`);
  //     await diffViewManager.acceptFile(fileUri.fsPath);
  //     vscode.window.showInformationMessage('Changes accepted successfully.');
  //   })
  // );

  // // Reject changes in the active file
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('deputydev.rejectChanges', async () => {
  //     const editor = vscode.window.activeTextEditor;
  //     if (!editor) {
  //       vscode.window.showErrorMessage('No active editor to reject changes for.');
  //       return;
  //     }
  //     const fileUri = editor.document.uri;
  //     await diffViewManager.rejectFile(fileUri.fsPath);
  //     vscode.window.showInformationMessage('Changes rejected successfully.');
  //   })
  // );

  // // If you want commands for accepting or rejecting ALL tracked files:
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('deputydev.acceptAllChanges', async () => {
  //     outputChannel.info(`Accepting changes for all file`);
  //     await diffViewManager.acceptAllFile();
  //     vscode.window.showInformationMessage('All changes accepted.');
  //   })
  // );
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('deputydev.rejectAllChanges', async () => {
  //     await diffViewManager.rejectAllFile();
  //     vscode.window.showInformationMessage('All changes rejected.');
  //   })
  // );

  // Command to open a diff view for any file path + new content
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.openDiffView', async (path: string, content: string) => {
      if (!diffViewManager) {
        vscode.window.showErrorMessage('Diff view manager is not initialized.');
        return;
      }
      try {
        await diffViewManager.openDiffView({ path, content });
        vscode.window.showInformationMessage(`Diff view opened for ${path}`);
      } catch (error) {
        outputChannel.error(`Failed to open diff view: ${error}`);
        vscode.window.showErrorMessage('Failed to open diff view.');
      }
    })
  );



  // add button click
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.AddButtonClick', () => {
      outputChannel.info('Add button clicked!');
      sidebarProvider.newChat();
      deleteSessionId();
    }),
  );

  // setting button click
  context.subscriptions.push(
    vscode.commands.registerCommand('deputydev.SettingButtonClick', () => {
      outputChannel.info('Setting button clicked!');
      sidebarProvider.setViewType('setting');
    }),
  );


  //  8) Show the output channel if needed & start server

  chatService.start();
  outputChannel.show();
}

export function deactivate() {
  outputChannel?.info('Extension "DeputyDev" is now deactivated!');
}


