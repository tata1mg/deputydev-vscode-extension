// File: src/embedding/WorkspaceManager.ts

import * as vscode from 'vscode';
import * as path from 'path';

export class WorkspaceManager {
  private workspaceFolderPaths: string[] = [];
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.updateWorkspaceFolders();
    this.subscribeToWorkspaceFolderChanges();
  }

  /**
   * Updates the internal array of workspace folder paths.
   */
  private updateWorkspaceFolders() {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      this.workspaceFolderPaths = folders.map((folder) => folder.uri.fsPath);
    } else {
      this.workspaceFolderPaths = [];
    }
  }

  /**
   * Subscribes to workspace folder change events to dynamically update folder paths.
   */
  private subscribeToWorkspaceFolderChanges() {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        this.updateWorkspaceFolders();
        // Optionally inform the user or log the change.
        vscode.window.showInformationMessage(
          `Workspace folders updated: ${this.workspaceFolderPaths.join(', ') || 'None'}`
        );
      })
    );
  }

  /**
   * Returns the current workspace folder paths.
   * If there are no workspace folders open, returns an empty array.
   */
  public getWorkspaceFolderPaths(): string[] {
    return this.workspaceFolderPaths;
  }

  /**
   * If no workspace folder is open, this returns the directory of the currently active file.
   * Returns null if no file is open.
   */
  public getActiveFileDirectory(): string | null {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const activeFilePath = editor.document.uri.fsPath;
      return path.dirname(activeFilePath);
    }
    return null;
  }

  /**
   * Returns "relevant" paths for the extension:
   * - If one or more workspace folders are open, it returns their paths.
   * - Otherwise, if an active file is open, it returns its directory.
   * - If neither is available, returns an empty array.
   */
  public getRelevantPaths(): string[] {
    if (this.workspaceFolderPaths.length > 0) {
      return this.workspaceFolderPaths;
    }
    const activeDir = this.getActiveFileDirectory();
    return activeDir ? [activeDir] : [];
  }
}
