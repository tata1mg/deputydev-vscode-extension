// File: src/panels/CodeEditorMenu.ts
import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

export function registerCodeEditorMenuCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
) {
  const codeEditorMenuCommand = 'deputydev.editThisCode';
  const commandHandler = () => {
    const editor = vscode.window.activeTextEditor;  // Get the active editor
    if (editor) {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const filePath = editor.document.uri.fsPath; // We also get the file path of the active editor
      
      if (selectedText.trim() === '') {
        vscode.window.showWarningMessage('No text selected to edit.');
        return;
      }

      // await vscode.commands.executeCommand('workbench.view.extension.deputydev-sidebar-view');
      
      
      // Send a message to the sidebar with both the snippet AND the file path (not used rn) 
      // sidebarProvider.sendMessageToSidebar({
      //   type: 'edit-file-snippet',
      //   filePath,        // e.g. "/Users/me/project/file.js"
      //   snippet: selectedText,
      // });
      
      // console.log('Selected text:', selectedText);
      // console.log('File path:', filePath);
      // Reveal the sidebar if it's not already open
      vscode.commands.executeCommand('workbench.view.extension.deputydev-sidebar-view');
    } else {
      vscode.window.showErrorMessage('No active editor found.');
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(codeEditorMenuCommand, commandHandler)
  );
}
