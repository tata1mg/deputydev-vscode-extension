import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

/**
 * Closes open editors of files named 'debug.log' in the ~/.deputydev/logs directory.
 */
export async function closeDeputyDevDebugTabs() {
  const homeDir = os.homedir();
  const logsBaseDir = path.join(homeDir, '.deputydev', 'logs');

  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        const fsPath = tab.input.uri.fsPath;
        if (fsPath.startsWith(logsBaseDir) && fsPath.endsWith('debug.log')) {
          try {
            await vscode.window.tabGroups.close(tab, false);
          } catch (err) {
            // Ignore error, continue closing others
          }
        }
      }
    }
  }
}
