import * as vscode from 'vscode';
import { SidebarProvider } from '../panels/SidebarProvider';
import { WorkspaceManager } from './WorkspaceManager';
import { updateVectorStore, UpdateVectorStoreParams } from '../clients/common/websocketHandlers';

export class WebviewFocusListener {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly sidebarProvider: SidebarProvider,
        private readonly workspaceManager: WorkspaceManager,
        private outputChannel: vscode.LogOutputChannel,
    ) {
        // Subscribe to webview focus event
        this.sidebarProvider.onWebviewFocused(() => {
            this.handleWebviewFocus();
        });
    }

    private handleWebviewFocus(): void {
        this.outputChannel.info('Webview focused, updating vector store...');
        const active_repo = this.context.workspaceState.get<string>('activeRepo');
        if (!active_repo) {
            this.outputChannel.error('No active repository found. cant update vector store.');
            return;
        }
        const params: UpdateVectorStoreParams = { repo_path: active_repo };
        this.outputChannel.info(`📡 Sending WebSocket update: ${JSON.stringify(params)}`);
        updateVectorStore(params);

    }

    
}
