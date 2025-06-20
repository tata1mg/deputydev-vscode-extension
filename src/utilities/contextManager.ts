import * as vscode from 'vscode';
import { SidebarProvider } from '../panels/SidebarProvider';
import { v4 as uuidv4 } from 'uuid';

let extensionContext: vscode.ExtensionContext | null = null;
const logOutputChannel: vscode.LogOutputChannel | null = null;
let sidebarProvider: SidebarProvider | null = null;

export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
}

export function setSidebarProvider(provider: SidebarProvider) {
  sidebarProvider = provider;
}

// export function getAuthToken(): string | undefined {
//     return  extensionContext?.workspaceState.get<string>('authToken');
// }

export function getSessionId(): number | undefined {
  const session = extensionContext?.workspaceState.get<number>('sessionId');
  return session;
}

export function deleteSessionId() {
  return extensionContext?.workspaceState.update('sessionId', undefined);
}

export function setSessionId(value: number) {
  logOutputChannel?.info(`Setting session ID received for update: ${value}`);
  extensionContext?.workspaceState.update('sessionId', value);
  return;
}

export function sendProgress(progressBarData: { repo: string; progress: number; status: string }) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'progress-bar',
    data: progressBarData,
  });
}

export function sendForceUpgrade() {
  sidebarProvider?.sendMessageToSidebar('force-upgrade-needed');
}

export function sendNotVerified() {
  vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', false);
  extensionContext?.workspaceState.update('isAuthenticated', false);
  // delay for 0.2 second
  setTimeout(() => {
    sidebarProvider?.sendMessageToSidebar('NOT_VERIFIED');
  }, 200);
}

export function sendForceUgradeData(data: { url: string; upgradeVersion: string }) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'force-upgrade-data',
    data: data,
  });
}
export function loaderMessage(showMsg: boolean) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'loader-message',
    data: showMsg,
  });
}

export function sendLastChatData(data: string) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'last-chat-data',
    data: data,
  });
}

export function updateWorkspaceToolStatus(data: { tool_use_id: string; status: string }) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'update-workspace-tool-status',
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

export function terminalProcessCompleted(data: { toolUseId: string; exitCode: number }) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'terminal-process-completed',
    data: data,
  });
}

export function setCancelButtonStatus(Status: boolean){
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: 'set-cancel-button-status',
    data: Status,
  });
}
export function getActiveRepo(): string | undefined {
  return extensionContext?.workspaceState.get<string>('activeRepo');
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


export async function clearWorkspaceStorage(isLogout: boolean = false) {
  if (!extensionContext) {
    return;
  }
  if (isLogout) {
    await extensionContext.workspaceState.update('authToken', false);
    await extensionContext.workspaceState.update('configData', undefined);
    await extensionContext.workspaceState.update('auth-storage', undefined);
    await extensionContext.workspaceState.update('chat-storage', undefined);
    await extensionContext.workspaceState.update('user-profile-store', undefined);
    await extensionContext.workspaceState.update('sessionId', undefined);
    await extensionContext.workspaceState.update('isAuthenticated', false);
    await extensionContext.workspaceState.update('sessions-storage', undefined);
    return;
  }
  await extensionContext.workspaceState.update('authToken', false);
  await extensionContext.workspaceState.update('essentialConfigData', undefined);
  await extensionContext.workspaceState.update('configData', undefined);
  await extensionContext.workspaceState.update('auth-storage', undefined);
  await extensionContext.workspaceState.update('workspace-storage', undefined);
  await extensionContext.workspaceState.update('view-state-storage', undefined);
  // await extensionContext.workspaceState.update("chat-type-storage", undefined);
  await extensionContext.workspaceState.update('sessions-storage', undefined);
  await extensionContext.workspaceState.update('chat-storage', undefined);
  await extensionContext.workspaceState.update('user-profile-store', undefined);
  await extensionContext.workspaceState.update('repo-selector-storage', false);
  await extensionContext.workspaceState.update('sessionId', undefined);
  await extensionContext.workspaceState.update('force-upgrade-storage', undefined);
  await extensionContext.workspaceState.update('loader-view-state-storage', undefined);
  await extensionContext.workspaceState.update('vscode-theme-storage', undefined);
  await extensionContext.workspaceState.update('isAuthenticated', false);
  await extensionContext.workspaceState.update('activeRepo', undefined);
  await extensionContext.workspaceState.update('mcp-storage', undefined);
}
