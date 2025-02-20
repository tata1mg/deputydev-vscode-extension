// File: src/utils/FileWatcher.ts
import * as vscode from 'vscode';
import { updateVectorStore, subscribeToVectorStoreUpdates } from "../services/websockets/websocketHandlers";

export class FileWatcher {
    private outputChannel: vscode.LogOutputChannel;
    private fileWatcher: vscode.FileSystemWatcher;
    private pendingFileChanges: Set<string> = new Set();
    private changeTimeout: NodeJS.Timeout | null = null;

    constructor(outputChannel: vscode.LogOutputChannel) {
        this.outputChannel = outputChannel;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");

        // File change listeners with batching
        this.fileWatcher.onDidChange(uri => this.scheduleFileUpdate(uri.fsPath));
        this.fileWatcher.onDidCreate(uri => this.scheduleFileUpdate(uri.fsPath));
        this.fileWatcher.onDidDelete(uri => this.scheduleFileUpdate(uri.fsPath));

        // Workspace folder change listener
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

    /**
     * Schedules a batch update instead of handling each file change separately.
     */
    private scheduleFileUpdate(filePath: string) {
        this.pendingFileChanges.add(filePath);

        if (this.changeTimeout) {
            clearTimeout(this.changeTimeout);
        }

        this.changeTimeout = setTimeout(() => this.processFileUpdates(), 500);
    }

    /**
     * Processes all collected file changes after a delay.
     */
    private processFileUpdates() {
        if (this.pendingFileChanges.size > 0) {
            const fileList = Array.from(this.pendingFileChanges).join(', ');
            this.outputChannel.info(`Batch file update: ${fileList}`);
            vscode.window.showInformationMessage(`Files updated: ${fileList}`);
            this.pendingFileChanges.clear();
        }
    }

    /**
     * Dispose the watcher when extension is deactivated.
     */
    public dispose() {
        this.fileWatcher.dispose();
        if (this.changeTimeout) {
            clearTimeout(this.changeTimeout);
        }
    }
}
