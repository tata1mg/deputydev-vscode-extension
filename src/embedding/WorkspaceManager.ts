// File: src/embedding/WorkspaceManager.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { SidebarProvider } from '../panels/SidebarProvider';

export class WorkspaceManager {
  private workspaceRepos: Map<string, string> = new Map();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.updateWorkspaceRepos();
    this.subscribeToWorkspaceFolderChanges();
  }

  /**
   * Updates the internal map of workspace repository paths and names.
   */
  private updateWorkspaceRepos() {
    const folders = vscode.workspace.workspaceFolders;
    this.workspaceRepos.clear();
    if (folders && folders.length > 0) {
      folders.forEach((folder) => {
        const repoName = path.basename(folder.uri.fsPath);
        this.workspaceRepos.set(folder.uri.fsPath, repoName);
      });
    }
  }
  /**
   * Subscribes to workspace folder change events to dynamically update repo paths.
   */
  private subscribeToWorkspaceFolderChanges() {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.updateWorkspaceRepos();
        // Optionally inform the user or log the change.
        vscode.window.showInformationMessage(
          `Workspace repositories updated: ${Array.from(this.workspaceRepos.entries()).map(([path, name]) => `${name} (${path})`).join(', ') || 'None'}`
        );
      })
    );
  }

  /**
   * Returns the current workspace repository paths and names.
   * If there are no repositories open, returns an empty map.
   */
  public getWorkspaceRepos(): Map<string, string> {
    return this.workspaceRepos;
  }
}