import * as vscode from 'vscode';
import { updateWorkspaceToolStatus, updateCurrentWorkspaceDD } from '../../utilities/contextManager';

// helper to detect “real” workspace (saved or in-memory multi-root)
function isMultiRootWorkspace(): boolean {
  const wf = vscode.workspace.workspaceFolders ?? [];
  // either a .code-workspace is open, or there are already ≥2 folders
  return !!vscode.workspace.workspaceFile || wf.length > 1;
}

export async function createNewWorkspaceFn(
  chatId: string,
  tool_use_id: string,
  context: vscode.ExtensionContext,
  outputChannel: vscode.LogOutputChannel,
) {
  const selectedFolder = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select an empty workspace folder',
    title: 'Open Folder as New Workspace',
  });

  if (!selectedFolder?.[0]) {
    return;
  }
  const folderUri = selectedFolder[0];
  const alreadyAdded = vscode.workspace.workspaceFolders?.some((wf) => wf.uri.toString() === folderUri.toString());

  updateWorkspaceToolStatus({ tool_use_id, status: 'completed' });
  await new Promise((r) => setTimeout(r, 100));
  const isMultiRootWorkspaceFlag = isMultiRootWorkspace();
  if (alreadyAdded) {
    // The folder is already in the workspace: trigger your update immediately
    updateCurrentWorkspaceDD();
    return; // Stop here, no need to add the folder or set up event listeners
  }
  outputChannel.info(`[debug] isMultiRootWorkspace: ${isMultiRootWorkspaceFlag}`);

  if (isMultiRootWorkspaceFlag) {
    // ——— WE ARE ALREADY IN A WORKSPACE ———
    // skip copying chat/session (no restart will happen),
  } else {
    // ——— SINGLE-FOLDER MODE ———
    // this add will cause VS Code to reload into an untitled workspace,
    // so copy your session data into globalState now:
    const pendingChatSession = context.workspaceState.get('chat-storage');
    await context.globalState.update('chat-storage-copy', pendingChatSession);
    await context.globalState.update('chatId-copy', chatId);
  }

  // finally actually add the folder into the workspace
  vscode.workspace.updateWorkspaceFolders(
    vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
    /* deleteCount */ 0,
    { uri: folderUri },
  );
  if (isMultiRootWorkspaceFlag) {
    const disposable = vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const added of event.added) {
        if (added.uri.toString() === folderUri.toString()) {
          updateCurrentWorkspaceDD();
          disposable.dispose(); // stop tracking
          break;
        }
      }
    });
  }
}
