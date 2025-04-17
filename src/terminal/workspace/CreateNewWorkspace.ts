import * as vscode from 'vscode';
import * as path from 'path';

export async function createNewWorkspace() {
  const selectedFolder = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Parent Folder"
  });

  if (!selectedFolder) return;

  const newFolderPath = path.join(selectedFolder[0].fsPath, 'MyNewProject');
  const newFolderUri = vscode.Uri.file(newFolderPath);

  await vscode.workspace.fs.createDirectory(newFolderUri);
  await vscode.commands.executeCommand('vscode.openFolder', newFolderUri, true);
}
