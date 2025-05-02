import * as vscode from 'vscode';

export class ChangeProposerDocument implements vscode.CustomDocument {
  public content: string = '';

  constructor(public readonly uri: vscode.Uri) {}

  async init(): Promise<void> {
    const content = await vscode.workspace.fs.readFile(this.uri);
    this.content = Buffer.from(content).toString('utf-8');
  }

  dispose(): void {
    // No-op for now
  }
}
