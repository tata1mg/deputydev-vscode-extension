import * as path from 'path';
import * as vscode from 'vscode';

export class ChangeProposerDocument implements vscode.CustomDocument {
  public content: string = '';
  public repoPath: string = '';
  public filePath: string = '';
  public language: string = 'plaintext';

  constructor(public readonly uri: vscode.Uri) {}

  private async getLanguageFromFilePath(filePath: string, repoPath: string): Promise<string> {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(repoPath, filePath)));
      let monacoLanguage = doc.languageId;
      if (monacoLanguage === 'javascriptreact') {
        monacoLanguage = 'javascript';
      } else if (monacoLanguage === 'typescriptreact') {
        monacoLanguage = 'typescript';
      }
      return monacoLanguage;
    } catch (error) {
      console.error(`Failed to get language for ${filePath}:`, error);
      return 'plaintext';
    }
  }

  async init(): Promise<void> {
    const content = await vscode.workspace.fs.readFile(this.uri);
    this.repoPath = Buffer.from(this.uri.query, 'base64').toString('utf-8');
    this.filePath = this.uri.path;
    this.content = Buffer.from(content).toString('utf-8');
    this.language = await this.getLanguageFromFilePath(this.filePath, this.repoPath);
  }

  dispose(): void {
    // No-op for now
  }
}
