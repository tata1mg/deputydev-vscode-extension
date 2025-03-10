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

