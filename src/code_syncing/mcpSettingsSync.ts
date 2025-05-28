import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';

/**
 * Watch for saves to a specific file, even if it's not in the workspace.
 * @param context - The extension context
 * @param filePath - Absolute path of the file to watch
 * @param onSave - Callback for when the file is saved
 */
export function watchMcpFileSave(
  context: vscode.ExtensionContext,
  onSave: (document: vscode.TextDocument) => void,
): void {
  const homeDir = os.homedir();
  const filePath = path.join(homeDir, '.deputydev', 'mcp_settings.json');
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
      if (document.uri.fsPath === filePath) {
        onSave(document);
      }
    }),
  );
}
