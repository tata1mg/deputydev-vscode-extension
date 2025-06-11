import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';
import { MCP_CONFIG_PATH } from '../config';

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
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
      if (document.uri.fsPath === MCP_CONFIG_PATH) {
        onSave(document);
      }
    }),
  );
}
