import * as vscode from 'vscode';
import { SidebarProvider } from '../panels/SidebarProvider';
import { v4 as uuidv4 } from "uuid";

let extensionContext: vscode.ExtensionContext | null = null;
let logOutputChannel: vscode.LogOutputChannel | null = null;
let sidebarProvider: SidebarProvider | null = null;

export function setExtensionContext(
  context: vscode.ExtensionContext,
) {
  extensionContext = context;
}

export function setSidebarProvider(provider: SidebarProvider) {
  sidebarProvider = provider
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
  return
}


export function sendProgress(progress: number) {
  sidebarProvider?.sendMessageToSidebar({
    id: uuidv4(),
    command: "progress-bar",
    data: progress,
  })
}



export function getActiveRepo(): string | undefined {
  return extensionContext?.workspaceState.get<string>('activeRepo');
}

export async function clearWorkspaceStorage() {
  if (!extensionContext)
   {
    // console.log('extensionContext is not defined');
    return;
   }
  await extensionContext.workspaceState.update("authToken", false);
  await extensionContext.workspaceState.update("essentialConfigData", undefined);
  await extensionContext.workspaceState.update("configData", undefined);
  await extensionContext.workspaceState.update("auth-storage", false);
  await extensionContext.workspaceState.update("workspace-storage", undefined);
  await extensionContext.workspaceState.update("view-state-storage", undefined);
  await extensionContext.workspaceState.update("chat-type-storage", undefined);
  await extensionContext.workspaceState.update("chat-storage", undefined);
  await extensionContext.workspaceState.update("repo-selector-storage", false);
  await extensionContext.workspaceState.update("sessionId", undefined);
}

