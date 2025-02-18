// File: src/utils/FileWatcher.ts
import * as vscode from 'vscode';
import { updateVectorStore, subscribeToVectorStoreUpdates } from "../services/websockets/websocketHandlers";

export class FileWatcher {
    private outputChannel: vscode.LogOutputChannel;
    private fileWatcher: vscode.FileSystemWatcher;

    constructor(outputChannel: vscode.LogOutputChannel) {
        this.outputChannel = outputChannel;

        // Initialize file watcher for all files
        this.fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");

        // Listen for file changes
        this.fileWatcher.onDidChange(uri => {
            this.outputChannel.info(`File changed: ${uri.fsPath}`);
            vscode.window.showInformationMessage(`File changed: ${uri.fsPath}`);
        });

        // Listen for file creations
        this.fileWatcher.onDidCreate(uri => {
            this.outputChannel.info(`File created: ${uri.fsPath}`);
            vscode.window.showInformationMessage(`File created: ${uri.fsPath}`);
        });

        // Listen for file deletions
        this.fileWatcher.onDidDelete(uri => {
            this.outputChannel.info(`File deleted: ${uri.fsPath}`);
            vscode.window.showInformationMessage(`File deleted: ${uri.fsPath}`);
        });

        // Listen for workspace folder changes
        vscode.workspace.onDidChangeWorkspaceFolders(event => {
            event.added.forEach(folder => {
                this.outputChannel.info(`Workspace folder added: ${folder.uri.fsPath}`);
                vscode.window.showInformationMessage(`Workspace folder added: ${folder.uri.fsPath}`);
            });

            event.removed.forEach(folder => {
                this.outputChannel.info(`Workspace folder removed: ${folder.uri.fsPath}`);
                vscode.window.showInformationMessage(`Workspace folder removed: ${folder.uri.fsPath}`);
            });
        });
    }

    // Dispose the watcher when extension is deactivated
    public dispose() {
        this.fileWatcher.dispose();
    }
}
