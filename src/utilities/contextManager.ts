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

