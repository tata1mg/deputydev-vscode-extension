import * as vscode from "vscode";







type DiffViewChange =
  | {
      type: "add";
      path: string;
    }
  | {
      type: "accept" | "reject";
      path: string; // file path, i.e., URI.fsPath
    };

export abstract class DiffViewManager {
  protected disposables: vscode.Disposable[] = [];
  protected _onDidChange = new vscode.EventEmitter<DiffViewChange>();
  readonly onDidChange = this._onDidChange.event;

  constructor() {
    this.disposables.push(this._onDidChange);
  }

  public dispose = () => {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  };

  // Show inline or side-by-side diff for given path+content
  abstract openDiffView(
    data: { path: string; content: string },
    session_id?: number,
    write_mode?: boolean,
    is_inline?: boolean,
    is_inline_modify?: boolean
  ): Promise<void>;

  // Accept *all* changes in all tracked files
  abstract acceptAllFile(): Promise<void>;
  // Reject *all* changes in all tracked files
  abstract rejectAllFile(): Promise<void>;
  // Accept changes for one file
  abstract acceptFile(path: string): Promise<void>;
  // Reject changes for one file
  abstract rejectFile(path: string): Promise<void>;
}
