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

