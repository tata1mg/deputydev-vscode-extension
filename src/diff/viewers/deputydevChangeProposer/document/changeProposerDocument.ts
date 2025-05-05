import * as vscode from 'vscode';

export class ChangeProposerDocument implements vscode.CustomDocument {
  public content: string = '';
  public repoPath: string = '';
  public filePath: string = '';

  constructor(public readonly uri: vscode.Uri) {}

  async init(): Promise<void> {
    const content = await vscode.workspace.fs.readFile(this.uri);
    this.repoPath = Buffer.from(this.uri.query, 'base64').toString('utf-8');
    this.filePath = this.uri.path.split('.ddproposed')[0];
    this.content = Buffer.from(content).toString('utf-8');
  }

  dispose(): void {
    // No-op for now
  }
}
