import * as vscode from 'vscode';

export class ProposedChangeEditorFsProvider implements vscode.FileSystemProvider {
  onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>().event;

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => { });
  }

  stat(): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0
    };
  }

  readFile(): Uint8Array {
    return new Uint8Array(); // content is passed via URI query
  }

  // The rest are no-ops
  writeFile() { }
  delete() { }
  rename() { }
  readDirectory(): [string, vscode.FileType][] { return []; }
  createDirectory() { }
}