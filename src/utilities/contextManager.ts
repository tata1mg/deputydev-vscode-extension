import * as vscode from 'vscode';

let extensionContext: vscode.ExtensionContext | null = null;
let logOutputChannel: vscode.LogOutputChannel | null = null;

export function setExtensionContext(
  context: vscode.ExtensionContext,
  outputChannel: vscode.LogOutputChannel
) {
  extensionContext = context;
  logOutputChannel = outputChannel;
}

export function getAuthToken(): string | undefined {
  return extensionContext?.globalState.get<string>('authToken');
}


export function getSessionId(): number | undefined {
  const session = extensionContext?.workspaceState.get<number>('sessionId');
  return session;
}



export function deleteSessionId() {
  return extensionContext?.workspaceState.update('sessionId', undefined);
}



export function setSessionId(value: number ) {
  logOutputChannel?.info(`Setting session ID received for update: ${value}`);
  extensionContext?.workspaceState.update('sessionId', value);
  return
}








export function getQueryId(): number | undefined {
  const session = extensionContext?.workspaceState.get<number>('queryId');
  return session;
}



export function deleteQueryId() {
  return extensionContext?.workspaceState.update('queryId', undefined);
}



export function setQueryId(value: number ) {
  logOutputChannel?.info(`Setting query ID received for update: ${value}`);
  extensionContext?.workspaceState.update('queryId', value);
  return
}



export function getActiveRepo(): string | undefined {
  return extensionContext?.workspaceState.get<string>('activeRepo');
}

