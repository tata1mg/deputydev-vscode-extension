import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getActiveRepo } from '../utilities/contextManager';
import { arePathsEqual } from '../utilities/path';
import { ChatPayload } from '../types';
const PREVIEW_LINES = 100; // Number of lines to preview in the active file
export async function getEnvironmentDetails(
  includeFileDetails: boolean = false,
  payload?: ChatPayload,
): Promise<string> {
  let details = '';

  // --- Get Current Working Directory ---
  const cwd = getActiveRepo();
  if (!cwd) {
    return '<environment_details>\n(No active repo found)\n</environment_details>';
  }
  details += `# Current Working Directory\n${cwd}`;

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

  // --- OPTIONAL: Show active-file preview or selection ---
  if (payload?.active_file_reference?.active_file) {
    const { active_file, start_line, end_line } = payload.active_file_reference;
    // Resolve path relative to cwd if it isn’t already absolute
    const absolutePath = path.join(cwd, active_file);
    const relativePath = path.relative(cwd, absolutePath).replace(/\\/g, '/');

    try {
      const fileText = await fs.promises.readFile(absolutePath, 'utf8');
      const lines = fileText.split(/\r?\n/);
      const totalLines = lines.length;

      if (
        typeof start_line === 'number' &&
        typeof end_line === 'number' &&
        start_line >= 1 &&
        end_line >= start_line &&
        end_line <= totalLines
      ) {
        // Show the explicitly selected region
        const excerpt = lines.slice(start_line - 1, end_line).join('\n');
        details +=
          `\n\n# Active File Selection\n` +
          `Path: ${relativePath}\n` +
          `Total lines in file: ${totalLines}\n\n` +
          `Lines below are ${start_line}-${end_line} (as selected in the user's editor):\n` +
          `${excerpt}\n` +
          `\n(The user has this range selected in VS Code. It may or may not be relevant. ` +
          `If your task needs more context, you can load additional parts of the file using the appropriate tools.)`;
      } else {
        // Show only the first N lines (or fewer if the file is shorter)
        const previewLineCount = Math.min(PREVIEW_LINES, totalLines);
        const excerpt = lines.slice(0, previewLineCount).join('\n');
        details +=
          `\n\n# Active File Preview\n` +
          `Path: ${relativePath}\n` +
          `First ${previewLineCount} line${previewLineCount !== 1 ? 's' : ''} of ${totalLines} total lines in the active file:\n` +
          `${excerpt}\n` +
          `\n(The user currently has this file open in their VsCode editor. It may or may not be relevant. ` +
          `If your task needs more context, you can read further using the available tools.)`;
      }
    } catch (e: any) {
      details += `\n\n# Active File Preview\n(Path: ${relativePath})\n`;
    }
  }

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
