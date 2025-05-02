import * as vscode from 'vscode';
import { FileChangeStateManager } from '../../../fileChangeStateManager/fileChangeStateManager';

export class ChangeProposerFsProvider implements vscode.FileSystemProvider {
  onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>().event;

  constructor(
    private readonly fileChangeStateManager: FileChangeStateManager,
    private readonly outputChannel: vscode.LogOutputChannel,
  ) {
    this.fileChangeStateManager = fileChangeStateManager;
    this.outputChannel = outputChannel;
  }

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    };
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const content = this.fileChangeStateManager.getFileChangeState(
      uri.path.split('.ddproposed')[0], // remove the last .ddproposed
      Buffer.from(uri.query, 'base64').toString('utf-8'), // decode the base64 query for repoPath
    );

    this.outputChannel.info(`Reading file: ${uri.toString()}`);
    this.outputChannel.info(`Repo path: ${Buffer.from(uri.query, 'base64').toString('utf-8')}`);
    const contentStr = content?.currentUdiff;
    if (!contentStr) {
      throw new Error(`File not found: ${uri.toString()}`);
    }
    return Buffer.from(contentStr, 'utf-8');
  }

  // The rest are no-ops
  writeFile() {}
  delete() {}
  rename() {}
  readDirectory(): [string, vscode.FileType][] {
    return [];
  }
  createDirectory() {}
}
