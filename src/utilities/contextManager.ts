import * as vscode from 'vscode';

let extensionContext: vscode.ExtensionContext | null = null;

export function setExtensionContext(context: vscode.ExtensionContext) {
  extensionContext = context;
}

export function getAuthToken(): string | undefined {
  return  "replace with below or use own token";
  return extensionContext?.globalState.get<string>('authToken');
}
