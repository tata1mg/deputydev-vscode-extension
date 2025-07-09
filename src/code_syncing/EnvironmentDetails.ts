import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getActiveRepo, getRepositoriesForContext } from '../utilities/contextManager';
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
  const contextRepositories = getRepositoriesForContext();
  if (!cwd) {
    return '<environment_details>\n(No active repository found)\n</environment_details>';
  }

  // --- VSCode Visible Files (Filtered by context repositories and grouped by repo name) ---
  details += '\n\n# VSCode Visible Files';
  const visibleFilePaths = vscode.window.visibleTextEditors
    ?.map((editor) => editor.document?.uri?.fsPath)
    .filter(Boolean);

  // Group visible files by repository
  const visibleFilesByRepo: { [repoName: string]: string[] } = {};
  contextRepositories?.forEach((repo) => {
    visibleFilesByRepo[repo.repoName] = [];
  });

  visibleFilePaths?.forEach((path) => {
    const repo = contextRepositories?.find((repo) => path.startsWith(repo.repoPath));
    if (repo) {
      visibleFilesByRepo[repo.repoName].push(path);
    }
  });

  // Output grouped by repository
  let hasVisibleFiles = false;
  for (const [repoName, paths] of Object.entries(visibleFilesByRepo)) {
    if (paths.length > 0) {
      hasVisibleFiles = true;
      details += `\n\n## Repository: ${repoName}\n${paths.map((path) => `Absolute Path: ${path}`).join('\n')}`;
    }
  }

  if (!hasVisibleFiles) {
    details += '\n(No visible files in this workspace)';
  }

  // --- VSCode Open Tabs (Filtered by context repositories and grouped by repo name) ---
  details += '\n\n# VSCode Open Tabs';

  const openTabPaths = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
    .filter(Boolean)
    .filter((absolutePath) => contextRepositories?.some((repo) => absolutePath.startsWith(repo.repoPath)));

  // Group open tab paths by repo name
  const openTabsByRepo: { [repoName: string]: string[] } = {};
  contextRepositories?.forEach((repo) => {
    openTabsByRepo[repo.repoName] = [];
  });
  openTabPaths.forEach((path) => {
    const repo = contextRepositories?.find((repo) => path.startsWith(repo.repoPath));
    if (repo) openTabsByRepo[repo.repoName].push(path);
  });

  // Sort repos by name
  const sortedRepoNames = Object.keys(openTabsByRepo).sort();

  // Output grouped and sorted by repo name
  let foundTabs = false;
  for (const repoName of sortedRepoNames) {
    const paths = openTabsByRepo[repoName];
    if (paths.length > 0) {
      foundTabs = true;
      details += `\n\n## Repository: ${repoName}\n${paths.map((path) => `Absolute Path: ${path}`).join('\n')}`;
    }
  }

  if (!foundTabs) {
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
    const absolutePath = active_file;

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
          `Path: ${absolutePath}\n` +
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
          `Path: ${absolutePath}\n` +
          `First ${previewLineCount} line${previewLineCount !== 1 ? 's' : ''} of ${totalLines} total lines in the active file:\n` +
          `${excerpt}\n` +
          `\n(The user currently has this file open in their VsCode editor. It may or may not be relevant. ` +
          `If your task needs more context, you can read further using the available tools.)`;
      }
    } catch (e: any) {
      details += `\n\n# Active File Preview\n(Path: ${absolutePath})\n`;
    }
  }

  return `<environment_details>\n${details.trim()}\n</environment_details>`;
}
