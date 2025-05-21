import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getActiveRepo } from '../utilities/contextManager';
import { arePathsEqual } from '../utilities/path';

export async function getEnvironmentDetails(includeFileDetails: boolean = false): Promise<string> {
  let details = '';

  // --- Get Current Working Directory ---
  const cwd = getActiveRepo();
  if (!cwd) {
    return '<environment_details>\n(No active repo found)\n</environment_details>';
  }

  // --- VSCode Visible Files (Filtered by cwd) ---
  details += '\n\n# VSCode Visible Files';
  const visibleFilePaths = vscode.window.visibleTextEditors
    ?.map((editor) => editor.document?.uri?.fsPath)
    .filter(Boolean)
    .filter((absolutePath) => absolutePath.startsWith(cwd)) // Only include files in cwd
    .map((absolutePath) => path.relative(cwd, absolutePath).replace(/\\/g, '/'));

  if (visibleFilePaths && visibleFilePaths.length > 0) {
    details += `\n${visibleFilePaths.join('\n')}`;
  } else {
    details += '\n(No visible files in this workspace)';
  }

  // --- VSCode Open Tabs (Filtered by cwd) ---
  details += '\n\n# VSCode Open Tabs';
  const openTabPaths = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
    .filter(Boolean)
    .filter((absolutePath) => absolutePath.startsWith(cwd)) // Only include files in cwd
    .map((absolutePath) => path.relative(cwd, absolutePath).replace(/\\/g, '/'));

  if (openTabPaths && openTabPaths.length > 0) {
    details += `\n${openTabPaths.join('\n')}`;
  } else {
    details += '\n(No open tabs in this workspace)';
  }

  // --- Current Time and Timezone ---
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  });
  const timeZone = formatter.resolvedOptions().timeZone;
  const timeZoneOffset = -now.getTimezoneOffset() / 60;
  const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? '+' : ''}${timeZoneOffset}:00`;
  details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`;

  // --- (Optional) Working Directory Files (root-level only, no ignore) ---
  if (includeFileDetails) {
    details += `\n\n# Current Working Directory Root Files & Folders\n`;

    const isDesktop = arePathsEqual(cwd, path.join(os.homedir(), 'Desktop'));
    if (isDesktop) {
      details += '(Desktop files not shown automatically. Use file_path_searcher to explore if needed.)';
    } else {
      try {
        const all = await fs.promises.readdir(cwd, { withFileTypes: true });
        const rootFilesAndFolders = all.map((dirent) => {
          if (dirent.isDirectory()) {
            return dirent.name + '/';
          }
          return dirent.name;
        });
        if (rootFilesAndFolders.length > 0) {
          details += rootFilesAndFolders.join('\n');
        } else {
          details += '(No files or folders in this directory)';
        }
      } catch (e: any) {
        details += `(Could not list files: ${e.message})`;
      }
    }
  }

  return `<environment_details>\n${details.trim()}\n</environment_details>`;
}
