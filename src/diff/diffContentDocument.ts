import * as vscode from 'vscode';

export class DiffContentDocument implements vscode.CustomDocument {
public content: string = '';

  constructor(public readonly uri: vscode.Uri) {}

  async init(): Promise<void> {
    const fileData = await vscode.workspace.fs.readFile(this.uri);
    this.content = Buffer.from(this.uri.query, 'base64').toString('utf-8');
  }

  dispose(): void {
    // No-op for now
  }
  }