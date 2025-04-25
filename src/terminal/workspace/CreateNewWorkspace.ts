import * as vscode from 'vscode';
import { updateWorkspaceToolStatus } from '../../utilities/contextManager';

export async function createNewWorkspaceFn(tool_use_id : string, context: vscode.ExtensionContext, outputChannel: vscode.LogOutputChannel) {
  const selectedFolder = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select an empty workspace folder",
    title: "Open Folder as New Workspace"
  });

  if (selectedFolder && selectedFolder.length > 0) {
    console.log("timestamp at vscode", new Date().toISOString());

    updateWorkspaceToolStatus({
      tool_use_id: tool_use_id,
      status: "completed"
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    const folderUri = selectedFolder[0];
    const pendingChatSession = context.workspaceState.get('chat-storage');
    // console.log("Pending chat session:", pendingChatSession);
    // console.log("timestamp at vscode 2", new Date().toISOString());

    const pendingChatSessionId = context.workspaceState.get('sessionId');
    context.globalState.update('sessionId-copy', pendingChatSessionId);
    context.globalState.update('chat-storage-copy', pendingChatSession);
    
    // Open the folder in a new window
    await vscode.commands.executeCommand('vscode.openFolder', folderUri, true);
  }
}
