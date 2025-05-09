import * as vscode from 'vscode';
import { FileChangeStateManager } from '../../../fileChangeStateManager/fileChangeStateManager';
import { promises as fs } from 'fs';
import * as path from 'path';

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

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const repoPath = Buffer.from(uri.query, 'base64').toString('utf-8');
    const filePath = uri.path;

    // Retrieve file state from the fileChangeStateManager
    const fileState = this.fileChangeStateManager.getFileChangeState(filePath, repoPath);

    if (!fileState) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    // In a virtual file system, we simulate metadata
    const content = fileState.currentUdiff; // Get the virtual file content
    const size = Buffer.byteLength(content, 'utf-8'); // Calculate the size of the content
    const mtime = Date.now(); // You can use the current time as the modification time
    const ctime = mtime; // In a virtual FS, creation time can be the same as mtime

    // Return a virtual file stat
    return {
      type: vscode.FileType.File, // Assuming this is a file (not a directory)
      ctime,
      mtime,
      size,
    };
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const content = this.fileChangeStateManager.getFileChangeState(
      uri.path,
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
  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): Promise<void> {
    console.log('Writing file:', uri.toString());
    const repoPath = Buffer.from(uri.query, 'base64').toString('utf-8');
    const filePath = uri.path;

    const fileChangeState = this.fileChangeStateManager.getFileChangeState(
      uri.path,
      Buffer.from(uri.query, 'base64').toString('utf-8'), // decode the base64 query for repoPath
    );

    if (!fileChangeState) {
      throw new Error(`File not found: ${uri.toString()}`);
    }
    // write to file system using native node
    try {
      await fs.writeFile(path.join(repoPath, filePath), fileChangeState.writeMode ? fileChangeState.modifiedContent : fileChangeState.originalContent, 'utf-8');
      console.log('File written successfully.');
    } catch (err) {
      console.error('Error writing file:', err);
    }

    // this.onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }
  delete() {}
  rename() {}
  readDirectory(): [string, vscode.FileType][] {
    return [];
  }
  createDirectory(uri: vscode.Uri): void {
    // Since this is a virtual filesystem, we assume directories don't matter.
    // Just log or silently ignore.
    this.outputChannel.info(`createDirectory called for ${uri.toString()}`);
  }
}
