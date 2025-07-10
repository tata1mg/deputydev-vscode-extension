import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { EmbeddingProgressData } from '../types';
import { SidebarProvider } from '../panels/SidebarProvider';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// =====================================================================================
// Module State
// =====================================================================================

let extensionContext: vscode.ExtensionContext | null = null;
const logOutputChannel: vscode.LogOutputChannel | null = null;
let sidebarProvider: SidebarProvider | null = null;

// =====================================================================================
// Initialization
// =====================================================================================

export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
}

export function setSidebarProvider(provider: SidebarProvider) {
  sidebarProvider = provider;
}

// =====================================================================================
// State Management (Getters, Setters, Clearers)
// =====================================================================================

export function getSessionId(): number | undefined {
  const session = extensionContext?.workspaceState.get<number>('sessionId');
  return session;
}

export function setSessionId(value: number) {
  logOutputChannel?.info(`Setting session ID received for update: ${value}`);
  extensionContext?.workspaceState.update('sessionId', value);
  return;
}

export function sendEmbeddingDoneMessage(embeddingProgressData: {
  task: string;
  status: string;
  repo_path: string;
  progress: number;
}) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'embedding-progress',
    data: embeddingProgressData,
  });
}

export function getRepositoriesForContext(): { repoPath: string; repoName: string }[] | undefined {
  return extensionContext?.workspaceState.get<{ repoPath: string; repoName: string }[]>('contextRepositories');
}

export function getActiveRepo(): string | undefined {
  return extensionContext?.workspaceState.get<string>('activeRepo');
}
export function deleteSessionId() {
  return extensionContext?.workspaceState.update('sessionId', undefined);
}

export function setCancelButtonStatus(Status: boolean) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'set-cancel-button-status',
    data: Status,
  });
}

export function getIsEmbeddingDoneForActiveRepo(): boolean {
  const activeRepo = getActiveRepo();
  const indexingDataStorage = extensionContext?.workspaceState.get('indexing-data-storage') as string;
  const parsedIndexingDataStorage = JSON.parse(indexingDataStorage);
  const embeddingProgressData = parsedIndexingDataStorage?.state?.embeddingProgressData as EmbeddingProgressData[];
  const repoSpecificEmbeddingProgress = embeddingProgressData.find((progress) => progress.repo_path === activeRepo);
  if (repoSpecificEmbeddingProgress && repoSpecificEmbeddingProgress.status === 'COMPLETED') {
    return true;
  }
  return false;
}

export function getUserData() {
  return extensionContext?.globalState.get('userData', undefined) as { email?: string; userName?: string } | undefined;
}

export function getIconPathObject(): vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon {
  if (!extensionContext) {
    // Fallback: use a single ThemeIcon (not in an object)
    return new vscode.ThemeIcon('terminal');
  }
  return {
    light: vscode.Uri.joinPath(extensionContext.extensionUri, 'assets', 'DD_logo_light.png'),
    dark: vscode.Uri.joinPath(extensionContext.extensionUri, 'assets', 'DD_logo_dark.png'),
  };
}

export function getUserSystemData(): Record<string, any> | undefined {
  return extensionContext?.globalState.get('user-system-data');
}

export async function clearWorkspaceStorage(isLogout: boolean = false) {
  if (!extensionContext) {
    return;
  }
  if (isLogout) {
    await extensionContext.secrets.delete('authToken');
    await extensionContext.workspaceState.update('configData', undefined);
    await extensionContext.workspaceState.update('chat-storage', undefined);
    await extensionContext.workspaceState.update('user-profile-store', undefined);
    await extensionContext.workspaceState.update('sessionId', undefined);
    await extensionContext.workspaceState.update('isAuthenticated', false);
    await extensionContext.workspaceState.update('sessions-storage', undefined);
    await extensionContext.globalState.update('userData', undefined);
    return;
  }
  await extensionContext.secrets.delete('authToken');
  await extensionContext.workspaceState.update('essentialConfigData', undefined);
  await extensionContext.workspaceState.update('configData', undefined);
  await extensionContext.workspaceState.update('auth-storage', undefined);
  await extensionContext.workspaceState.update('workspace-storage', undefined);
  await extensionContext.workspaceState.update('view-state-storage', undefined);
  await extensionContext.workspaceState.update('sessions-storage', undefined);
  await extensionContext.workspaceState.update('chat-storage', undefined);
  await extensionContext.workspaceState.update('user-profile-store', undefined);
  await extensionContext.workspaceState.update('repo-selector-storage', false);
  await extensionContext.workspaceState.update('sessionId', undefined);
  await extensionContext.workspaceState.update('force-upgrade-storage', undefined);
  await extensionContext.workspaceState.update('loader-view-state-storage', undefined);
  await extensionContext.workspaceState.update('vscode-theme-storage', undefined);
  await extensionContext.workspaceState.update('isAuthenticated', false);
  await extensionContext.workspaceState.update('mcp-storage', undefined);
  await extensionContext.workspaceState.update('indexing-data-storage', undefined);
  await extensionContext.workspaceState.update('active-file-store', undefined);
  await extensionContext.workspaceState.update('contextRepositories', undefined);
}

// =====================================================================================
// Sidebar Communication
// =====================================================================================

export function sendMessageToSidebarDirect(command: string, message: any) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: command,
    data: message,
  });
}

export function loaderMessage(showLoader: boolean, phase: string, progress?: number) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'loader-message',
    data: {
      showLoader: showLoader,
      phase: phase,
      progress: progress !== undefined ? progress : 0,
    },
  });
}

export function sendForceUpgrade(data: { url: string; upgradeVersion: string; currentVersion: string }) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'force-upgrade-data',
    data: data,
  });
}

export function sendLastChatData(data: string) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'last-chat-data',
    data: data,
  });
}

export function sendNotVerified() {
  logOutputChannel?.info('User is not authenticated, Please sign in');
  vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', false);
  extensionContext?.workspaceState.update('isAuthenticated', false);
  // delay for 0.1 second
  setTimeout(() => {
    sidebarProvider?.sendMessageToSidebar({
      id: uuidv4(),
      command: 'auth-response',
      data: 'NOT_VERIFIED',
    });
  }, 100);
}

export function sendProgress(indexingProgressData: {
  task: string;
  status: string;
  repo_path: string;
  progress: number;
  indexing_status: { file_path: string; status: string }[];
  is_partial_state: boolean;
}) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'indexing-progress',
    data: indexingProgressData,
  });
}
export function sendVerified() {
  logOutputChannel?.info('User is authenticated, sending verified response');
  vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', true);
  extensionContext?.workspaceState.update('isAuthenticated', true);
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'auth-response',
    data: 'AUTHENTICATED',
  });
}

export function terminalProcessCompleted(data: { toolUseId: string; exitCode: number }) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'terminal-process-completed',
    data: data,
  });
}

export function updateCurrentWorkspaceDD() {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'update-workspace-dd',
    data: true,
  });
}

export function updateWorkspaceToolStatus(data: { tool_use_id: string; status: string }) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'update-workspace-tool-status',
    data: data,
  });
}

export async function getContextRepositories(): Promise<
  Array<{ repo_path: string; repo_name: string; root_directory_context: string; is_working_repository: boolean }>
> {
  const contextRepositories = getRepositoriesForContext();

  if (!contextRepositories) {
    return [];
  }

  const activeRepo = getActiveRepo();

  // Filter out the active repo and map the rest
  const repoPromises = contextRepositories.map(async (repo) => ({
    repo_path: repo.repoPath,
    repo_name: repo.repoName,
    root_directory_context: await getRootContext(repo.repoPath),
    is_working_repository: repo.repoPath === activeRepo ? true : false,
  }));

  return Promise.all(repoPromises);
}

export async function getRootContext(repoPath: string): Promise<string> {
  const isDesktop = arePathsEqual(repoPath, path.join(os.homedir(), 'Desktop'));
  if (isDesktop) {
    return '';
  } else {
    try {
      const all = await fs.promises.readdir(repoPath, { withFileTypes: true });
      const rootFilesAndFolders = all.map((dirent) => {
        if (dirent.isDirectory()) {
          return dirent.name + '/';
        }
        return dirent.name;
      });
      if (rootFilesAndFolders.length > 0) {
        return rootFilesAndFolders.join('\n');
      } else {
        return '';
      }
    } catch (e: any) {
      return '';
    }
  }
}

function normalizePath(p: string): string {
  // normalize resolve ./.. segments, removes duplicate slashes, and standardizes path separators
  let normalized = path.normalize(p);
  // however it doesn't remove trailing slashes
  // remove trailing slash, except for root paths
  if (normalized.length > 1 && (normalized.endsWith('/') || normalized.endsWith('\\'))) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function arePathsEqual(path1?: string, path2?: string): boolean {
  if (!path1 && !path2) {
    return true;
  }
  if (!path1 || !path2) {
    return false;
  }

  path1 = normalizePath(path1);
  path2 = normalizePath(path2);

  if (process.platform === 'win32') {
    return path1.toLowerCase() === path2.toLowerCase();
  }
  return path1 === path2;
}
