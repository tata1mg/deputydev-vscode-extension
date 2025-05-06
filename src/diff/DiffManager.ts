// // File: src/diff/DiffManager.ts
// import * as vscode from 'vscode';

// /**
//  * An abstract/base class that defines how a diff operation should be performed,
//  * allowing different strategies (Side-by-Side, Inline, etc.).
//  */
// export abstract class DiffManager {
//   /**
//    * Opens a diff view for the original content vs. modified content.
//    *
//    * @param original - An object containing a Uri and the original text content.
//    * @param modified - An object containing a Uri and the modified text content.
//    */
//   public abstract openDiff(
//     original: { uri: vscode.Uri; content: string },
//     modified: { uri: vscode.Uri; content: string }
//   ): Promise<void>;

//   /**
//    * Accepts changes for a single file (if tracking changes).
//    *
//    * @param uri - The file's Uri you want to accept changes for.
//    */
//   public acceptFile?(uri: vscode.Uri): Promise<void>;

//   /**
//    * Rejects changes for a single file (if tracking changes).
//    *
//    * @param uri - The file's Uri you want to reject changes for.
//    */
//   public rejectChanges?(uri: vscode.Uri): Promise<void>;

//   /**
//    * Accepts changes for all currently tracked diff files (if you support multi-file).
//    */
//   public acceptAll?(): Promise<void>;

//   /**
//    * Rejects changes for all currently tracked diff files (if you support multi-file).
//    */
//   public rejectAll?(): Promise<void>;

//   /**
//    * Optional cleanup if you need to clear any resources or disposables.
//    */
//   public dispose?(): void;
// }

// File: src/diff/DiffManager.ts

import * as vscode from 'vscode';

type DiffViewChange =
  | {
      type: 'add';
      path: string;
    }
  | {
      type: 'accept' | 'reject';
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
    is_inline_modify?: boolean,
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
