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
  return "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";
  // return extensionContext?.globalState.get<string>('authToken');
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

