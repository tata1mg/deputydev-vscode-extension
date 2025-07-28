import * as vscode from 'vscode';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { ChatPayload, FileSummaryResponse } from '../types';
import { getActiveRepo, getRepositoriesForContext } from '../utilities/contextManager';
const FILE_CONTEXT_THRESHOLD = 100;

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
    const absolutePath = active_file;
    try {
      const req: any = {
        file_path: absolutePath,
        repo_path: '',
        number_of_lines: FILE_CONTEXT_THRESHOLD,
      };
      if (typeof start_line === 'number' && typeof end_line === 'number') {
        req.start_line = start_line;
        req.end_line = end_line;
      }
      const response = await binaryApi().post(API_ENDPOINTS.READ_FILE_OR_SUMMARY, req);
      const fileData = response.data;
      if (fileData.type === 'full') {
        details +=
          `\n\n# Active File Content\n` +
          `Absolute Path: ${absolutePath}\n` +
          `Total lines in file: ${fileData.total_lines}\n\n` +
          `Below is the full file content:\n\n` +
          `${fileData.content}\n` +
          `\n(The user currently has this file open in their VS Code. It may or may not be relevant.)`;
      } else if (fileData.type === 'selection') {
        details +=
          `\n\n# Active File Selection\n` +
          `Absolute Path: ${absolutePath}\n` +
          `Total lines in file: ${fileData.total_lines}\n\n` +
          `Lines below are ${fileData.start_line}-${fileData.end_line} (as selected in the user's editor):\n` +
          `${fileData.content}\n` +
          `\n(The user has this range selected in VS Code. It may or may not be relevant. If your task needs more context, you can load additional parts of the file using the appropriate tools.)`;
      } else if (fileData.type === 'summary') {
        details +=
          `\n\n# Active File Summary\n` +
          `Absolute Path: ${absolutePath}\n` +
          `Total lines in file: ${fileData.total_lines}\n\n` +
          `Below is an auto-generated summary of the file (line no, function signatures, key lines, etc):\n\n` +
          `${fileData.content}\n` +
          `\n(The user currently has this file open in their VS Code. It may or may not be relevant. ` +
          `\n(The file is long, so only a summary is shown. If your task needs more context, you can load additional parts of the file using the appropriate tools.)`;
      } else {
        details += `\n\n# Active File\n(Absolute Path: ${absolutePath})\n(File context could not be loaded.)`;
      }
    } catch (e: any) {
      details += `\n\n# Active File\n(Absolute Path: ${absolutePath})\n(File context could not be loaded.)`;
    }
  }

  return `<environment_details>\n${details.trim()}\n</environment_details>`;
}

async function _runFileSummaryReader(filePath: string): Promise<FileSummaryResponse | undefined> {
  try {
    const response = await binaryApi().post(API_ENDPOINTS.READ_FILE_OR_SUMMARY, {
      file_path: filePath,
    });
    return response.data;
  } catch (error: any) {
    return undefined;
  }
}
