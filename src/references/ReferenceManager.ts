import exp = require('constants');
import * as vscode from 'vscode';
import { ReferenceService } from '../services/references/ReferenceService';
import { v4 as uuidv4 } from 'uuid';


export class ReferenceManager {
    onStarted: () => void = () => { };
    onError: (error: Error) => void = () => { };
    private referenceService = new ReferenceService();

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.LogOutputChannel,
    ) { }

    async start() {
        this.outputChannel.info('Starting deputydev code reference service...');
    }

    restart() {
        this.outputChannel.info('Restarting deputydev code reference service...');
    }

    stop() {
        this.outputChannel.info('Stopping deputydev code reference service...');
    }

    async keywordSearch(payload: Object, sendMessage: (message: Object) => void) {
        const repo_path = this.context.workspaceState.get<string>('activeRepo');
        payload = { ...payload, repo_path };
        this.outputChannel.info('keywordSearch', payload);
        const response = await this.referenceService.keywordSearch(payload);
        this.outputChannel.info('keywordSearch-response', response);
        sendMessage({
            id: uuidv4(),
            command: 'keyword-search-response',
            data: response.response
        });
    }

    async keywordTypeSearch(payload: Object, sendMessage: (message: Object) => void) {  
        const repo_path = this.context.workspaceState.get<string>('activeRepo');
        payload = { ...payload, repo_path };
        this.outputChannel.info('keywordTypeSearch', payload);
        const response = await this.referenceService.keywordTypeSearch(payload);
        this.outputChannel.info('keywordTypeSearch-response', response);
        sendMessage({
            id: uuidv4(),
            command: 'keyword-type-search-response',
            data: response.response
        });
    }
}