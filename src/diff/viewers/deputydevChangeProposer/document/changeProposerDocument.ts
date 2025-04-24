import * as vscode from 'vscode';

export class ChangeProposerDocument implements vscode.CustomDocument {
public content: string = '';

  constructor(public readonly uri: vscode.Uri) {}

  async init(): Promise<void> {
    this.content = Buffer.from(this.uri.query, 'base64').toString('utf-8');
  }

  dispose(): void {
    // No-op for now
  }
  }