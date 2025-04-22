// File: src/diff/InlineDiffManager.ts

import { DiffViewManager } from "./DiffManager";
import * as vscode from "vscode";
import { UsageTrackingRequest } from "../types";
import { UsageTrackingManager } from "../usageTracking/UsageTrackingManager";
import { createTwoFilesPatch } from 'diff';


type RemovedChange = {
  type: "removed";
  line: number;
  count: number;
  value: string;
  session_id?: number;
  is_inline?: boolean;
  write_mode?: boolean;
  is_inline_modify?: boolean;
};

type AddedChange = {
  type: "added";
  line: number;
  count: number;
  value: string;
  session_id?: number;
  is_inline?: boolean;
  write_mode?: boolean;
  is_inline_modify?: boolean;
};

type Change =
  | RemovedChange
  | AddedChange
  | {
      type: "modified";
      removed: RemovedChange;
      added: AddedChange;
      session_id?: number;
      is_inline?: boolean;
      write_mode?: boolean;
      is_inline_modify?: boolean;
    };


type FileChangeState = {
  initialFileContent: string; // The initial content of the file before any changes. Used to revert to the original state.
  originalContent: string; // The original content based on the current udiff
  modifiedContent: string; // The modified content based on the current udiff
  currentUdiff: string; // The current udiff content
}

export class DeputyDevDiffViewManager extends DiffViewManager implements vscode.CodeLensProvider {
  private deletionDecorationType: vscode.TextEditorDecorationType;
  private insertionDecorationType: vscode.TextEditorDecorationType;
  // These properties store decoration types used to visually differentiate deleted and inserted content in the editor.

  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  // _onDidChangeCodeLenses is an event emitter to notify when the CodeLens should be updated.
  // onDidChangeCodeLenses exposes this event so other components can subscribe to it.

  // This map keeps track of the state of each file being edited.
  private readonly fileChangeStateMap = new Map<string, FileChangeState>();

  // This function parses the udiff string and extracts the original and modified content.
  // It returns an object containing the original and modified content.
  // The udiff format is a unified diff format, which is a common way to represent changes between two files.
  private getOriginalAndModifiedContentFromUdiff = (
    udiff: string,
  ): {
    originalContent: string;
    modifiedContent: string;
  } => {
    // Parse the udiff to extract original and modified content
    // This is a placeholder implementation. You need to implement the actual parsing logic.

    // firslly, handle CLRF and LF
    const lineEol = udiff.includes("\r\n") ? "\r\n" : "\n";
    const udiffWithEol = udiff.replace(/\r?\n/g, lineEol);

    // Split the udiff into lines
    // The udiff format typically starts with a line that begins with "@@", which indicates the start of a diff chunk.
    // The lines that start with "-" indicate lines that were removed, and lines that start with "+" indicate lines that were added.
    // The rest of the lines are context lines.
    const lines = udiffWithEol.split(lineEol);
    let originalContent = "";
    let modifiedContent = "";

    for (const line of lines) {
      if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) {
        // Skip the header line, or file path lines
        continue;
      }
      if (line.startsWith("-")) {
        originalContent += line.substring(1) + lineEol;
      } else if (line.startsWith("+")) {
        modifiedContent += line.substring(1) + lineEol;
      } else {
        // Context lines are added to both original and modified content
        originalContent += line + lineEol;
        modifiedContent += line + lineEol;
      }
    }
    return {
      originalContent: originalContent,
      modifiedContent: modifiedContent
    };
  };


  // This method updates the fileChangeStateMap with the original and modified content from the udiff.
  // It checks if the fileChangeStateMap already has the URI. If not, it sets the initial file content and udiff in the fileChangeStateMap.
  // If it does, it updates the udiff in the fileChangeStateMap.
  // It returns the original and modified content extracted from the udiff.
  private updateFileStateInFileChangeStateMap = (
    uri: string,
    udiff: string,
    initialFileContent?: string,
  ): {
    originalContent: string;
    modifiedContent: string;
  } => {
    // get original and modified content from the udiff
    const parsedUdiffContent =
      this.getOriginalAndModifiedContentFromUdiff(udiff);


    // Check if the fileChangeStateMap has the URI
    // if not, set the fileChangeState in fileChangeStateMap
    if (!this.fileChangeStateMap.has(uri)) {
      // if initialFileContent is not provided, throw an error
      if (!initialFileContent) {
        throw new Error(
          `Initial file content is required for the first time setting the udiff for ${uri}`
        );
      }
      // Set the initial file content and udiff in the fileChangeStateMap
      this.fileChangeStateMap.set(uri, {
        initialFileContent: initialFileContent,
        originalContent: parsedUdiffContent.originalContent,
        modifiedContent: parsedUdiffContent.modifiedContent,
        currentUdiff: udiff,   
      });
    } else {
      // update the udiff in the fileChangeStateMap
      this.fileChangeStateMap.set(uri, {
        ...this.fileChangeStateMap.get(uri)!,
        currentUdiff: udiff,
        originalContent: parsedUdiffContent.originalContent,  
        modifiedContent: parsedUdiffContent.modifiedContent,
      });
    }

    // return the original and modified content
    return {
      originalContent: parsedUdiffContent.originalContent,
      modifiedContent: parsedUdiffContent.modifiedContent,
    };
  }

  private getDiskFileContent = async (uri: string): Promise<string> => {
    const fileUri = vscode.Uri.file(uri);
    try {
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      return fileContent.toString();
    } catch (error) {
      this.outputChannel.error(`Error reading file: ${error}`);
      throw error;
    }
  };

  // This method retrieves the current content of the file based on the URI.
  // It checks if the fileChangeStateMap has the URI. If it does, it returns the original content from the fileChangeStateMap.
  // If it doesn't, it tries to read the file content from the file system.
  getCurrentContentOnWhichChangesAreToBeApplied = async (
    uri: string,
  ): Promise<string> => {
    const fileChangeState = this.fileChangeStateMap.get(uri);

    // if fileChangeState is not found, try to read the file content and return it
    if (!fileChangeState) {
      const fileContent = await this.getDiskFileContent(uri);
      return fileContent;
    }
    return fileChangeState.modifiedContent;
  }


  getOriginalContentToShowDiffOn = async (
    uri: string,
  ): Promise<string> => {
    const fileChangeState = this.fileChangeStateMap.get(uri);

    // if fileChangeState is not found, try to read the file content and return it
    if (!fileChangeState) {
      const fileContent = await this.getDiskFileContent(uri);
      return fileContent;
    }
    return fileChangeState.originalContent;
  }


  private getPreSaveEdits = async (document: vscode.TextDocument): Promise<vscode.TextEdit[]>  => {
    // if document is not in fileChangeStateMap, return empty array
    const fileChangeState = this.fileChangeStateMap.get(document.uri.fsPath);
    if (!fileChangeState) {
      return [];
    }

    const originalText = document.getText();
  
    // 🔧 Your transformation logic here
    const newText = fileChangeState.modifiedContent;
  
    if (newText === originalText) {
      return []; // No edits needed
    }
  
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(originalText.length)
    );
  
    return [vscode.TextEdit.replace(fullRange, newText)];
  }


  private fileChangeMap = new Map<
    string,
    {
      originalContent: string;
      modifiedContent: string;
      changes: Change[];
    }
  >();

  // fileChangeMap keeps track of the file changes.

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel
  ) {
    super();

    // Set initial context value
    vscode.commands.executeCommand("setContext", "deputydev.hasChanges", false);

    this.deletionDecorationType = vscode.window.createTextEditorDecorationType({
      light: { backgroundColor: "#fddbe2" },
      dark: { backgroundColor: "#3e1c23" },
      isWholeLine: true,
    });

    this.insertionDecorationType = vscode.window.createTextEditorDecorationType(
      {
        light: { backgroundColor: "#e6fde8" },
        dark: { backgroundColor: "#1c331e" },
        isWholeLine: true,
      }
    );

    // const diffProvider = new DiffContentProvider();
    // const providerRegistration =
    //   vscode.workspace.registerTextDocumentContentProvider(
    //     'deputydev-custom',
    //     diffProvider,
    //   );

    // this.disposables.push(providerRegistration);

    this.disposables.push(
      this.deletionDecorationType,
      this.insertionDecorationType,

      vscode.workspace.onDidCloseTextDocument((doc) => {
        if (doc.uri.scheme === "file" || doc.uri.scheme === "untitled") {
          const uri = doc.uri.toString();
          if (!this.fileChangeMap.has(uri)) {
            return;
          }
          this.fileChangeMap.delete(uri);
          this._onDidChange.fire({
            type: "reject",
            path: doc.uri.scheme === "file" ? doc.uri.fsPath : doc.uri.path,
          });
          this.outputChannel.debug(
            `Cleaned up decorations for ${doc.uri.fsPath}`
          );
        }
      }),

      // Listens for the event onDidCloseTextDocument, triggered when a document is closed in the editor.Checks if the closed document belongs to either file or untitled schemes.
      // If the document is tracked in fileChangeMap, it:Removes its entry from fileChangeMap.,Fires a change event (_onDidChange) of type 'reject' to indicate the file's changes are no longer valid.

      // Provide code lenses for file/untitled URIs
      vscode.languages.registerCodeLensProvider(
        [{ scheme: "file" }, { scheme: "untitled" }],
        this
      ),
      this._onDidChangeCodeLenses,
      // CodeLensProvider for files and untitled documents.. Associates the current instance of InlineDiffViewManager (this) as the provider,
      // enabling it to generate and manage CodeLens annotations in the supported documents.Registers a

      // Registering Commands

      // uriStr: string: The string representation of the file's URI where the diff chunk exists.
      // i: number: The index of the specific diff chunk to be accepted.

      // Accept single diff chunk
      vscode.commands.registerCommand(
        "deputydev.AcceptChange",
        (uriStr: string, i: number) => {
          if (typeof uriStr !== "string") {
            const uri = vscode.window.activeTextEditor?.document.uri;
            if (!uri) return;
            uriStr = uri.toString();
          }
          this.acceptChange(uriStr, i);
        }
      ),

      // Reject single diff chunk
      vscode.commands.registerCommand(
        "deputydev.RejectChange",
        (uriStr: string, i: number) => {
          if (typeof uriStr !== "string") {
            const uri = vscode.window.activeTextEditor?.document.uri;
            if (!uri) return;
            uriStr = uri.toString();
          }
          this.rejectChange(uriStr, i);
        }
      ),

      // Accept all changes in a file
      vscode.commands.registerCommand(
        "deputydev.AcceptAllChanges",
        (uri: vscode.Uri) => {
          this.acceptAllChanges(uri);
        }
      ),

      // Reject all changes in a file
      vscode.commands.registerCommand(
        "deputydev.RejectAllChanges",
        (uri: vscode.Uri) => {
          this.rejectAllChanges(uri);
        }
      ),

      // When active editor changes, re-draw decorations
      // if tab or file change. The extension checks the current opened file's URI in fileChangeMap. deputydev.hasChanges - > True if there are changes in the file, False otherwise.

      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          const uri = editor.document.uri.toString();
          const fileChange = this.fileChangeMap.get(uri);
          vscode.commands.executeCommand(
            "setContext",
            "deputydev.hasChanges",
            fileChange !== undefined && fileChange.changes.length > 0
          );
          if (fileChange) {
            this.outputChannel.debug("filechange here", fileChange);
            this.drawChanges(editor, fileChange);
          }
        } else {
          vscode.commands.executeCommand(
            "setContext",
            "deputydev.hasChanges",
            false
          );
        }
      }),
      // vscode.workspace.onWillSaveTextDocument(event => {
      //   // Modify the content before save by providing edits via waitUntil
      //   event.waitUntil(this.getPreSaveEdits(event.document));
      // }),
      // vscode.workspace.onDidSaveTextDocument(async document => {
      //   const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === document.uri.toString());
      //   if (!editor) return;
    
      //   // re-display the diff
      //   const fileChangeState = this.fileChangeStateMap.get(document.uri.fsPath);
      //   if (!fileChangeState) {
      //     return;
      //   }
      //   const displayableUdiff = fileChangeState.currentUdiff;
      //   const edit = new vscode.WorkspaceEdit();
      //   const fullRange = new vscode.Range(
      //     new vscode.Position(0, 0),
      //     new vscode.Position(editor.document.lineCount, 0)
      //   );
      //   edit.replace(editor.document.uri, fullRange, displayableUdiff);
      //   await vscode.workspace.applyEdit(edit);
      // })
    );
  }

  /**
   * Provide code lenses for each chunk so the user can individually accept/reject.
   */
  async provideCodeLenses(
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    const uri = document.uri.toString();
    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return [];
    }
    const codeLenses: vscode.CodeLens[] = [];

    for (let i = 0; i < fileChange.changes.length; i++) {
      const change = fileChange.changes[i];
      const line =
        change.type === "modified" ? change.removed.line : change.line;

      const range = new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, 0)
      );

      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Accept",
          command: "deputydev.AcceptChange",
          arguments: [document.uri.toString(), i],
        }),
        new vscode.CodeLens(range, {
          title: "Reject",
          command: "deputydev.RejectChange",
          arguments: [document.uri.toString(), i],
        })
      );
    }
    return codeLenses;
  }

  /**
   * Re-draw the decorations (added/removed lines) after changes.
   * If `index` & `count` are provided, we remove that chunk from memory.
   */
  private drawChanges(
    editor: vscode.TextEditor,
    fileChange: { changes: Change[] },
    index?: number,
    count?: number
  ) {
    // If we accepted/rejected a chunk, remove it and adjust subsequent line indices of other changes
    if (index !== undefined && count !== undefined) {
      for (let i = index + 1; i < fileChange.changes.length; i++) {
        const change = fileChange.changes[i];
        if (change.type === "modified") {
          change.removed.line -= count;
          change.added.line -= count;
        } else {
          change.line -= count;
        }
      }
      fileChange.changes.splice(index, 1);
    }

    // Build decoration arrays
    let deletions: vscode.DecorationOptions[] = [];
    let insertions: vscode.DecorationOptions[] = [];

    for (const change of fileChange.changes) {
      if (change.type === "removed") {
        deletions.push({
          range: new vscode.Range(
            new vscode.Position(change.line, 0),
            new vscode.Position(change.line + change.count - 1, 0)
          ),
        });
      } else if (change.type === "added") {
        insertions.push({
          range: new vscode.Range(
            new vscode.Position(change.line, 0),
            new vscode.Position(change.line + change.count - 1, 0)
          ),
        });
      } else {
        // modified chunk => has removed + added parts
        deletions.push({
          range: new vscode.Range(
            new vscode.Position(change.removed.line, 0),
            new vscode.Position(
              change.removed.line + change.removed.count - 1,
              0
            )
          ),
        });
        insertions.push({
          range: new vscode.Range(
            new vscode.Position(change.added.line, 0),
            new vscode.Position(change.added.line + change.added.count - 1, 0)
          ),
        });
      }
    }

    // Apply to editor
    editor.setDecorations(this.deletionDecorationType, deletions);
    editor.setDecorations(this.insertionDecorationType, insertions);

    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Utility: figure out which chunk the cursor is in (for AcceptChange/RejectChange w/o explicit index).
   */
  private getChangeIndex(
    editor: vscode.TextEditor,
    fileChange: { changes: Change[] }
  ): number {
    const line = editor.selection.active.line;

    for (let i = 0; i < fileChange.changes.length; i++) {
      const change = fileChange.changes[i];
      if (change.type === "added" || change.type === "removed") {
        if (line >= change.line && line < change.line + change.count) {
          return i;
        }
      } else {
        // 'modified'
        const start = change.removed.line;
        const end =
          change.removed.line + change.removed.count + change.added.count;
        if (line >= start && line < end) {
          return i;
        }
      }
    }
    return -1;
  }

  private getSourceForUsageTracking = (
    is_inline?: boolean,
    write_mode?: boolean,
    is_inline_modify?: boolean
  ) => {
    if (is_inline_modify) {
      return "inline-modify";
    }
    if (is_inline) {
      if (write_mode) {
        return "inline-chat-act";
      }
      return "inline-chat";
    } else {
      if (write_mode) {
        return "act";
      }
      return "chat";
    }
  };

  /**
   * Accept a single chunk (removed, added, or modified).
   */
  private async acceptChange(uri: string, i?: number) {
    this.outputChannel.info(`Accept change: ${uri}, index=${i}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== uri) {
      return;
    }

    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    let index: number;
    if (typeof i === "number") {
      index = i;
    } else {
      index = this.getChangeIndex(editor, fileChange);
      if (index === -1) {
        return;
      }
    }

    const change = fileChange.changes[index];

    const usageTrackingData: UsageTrackingRequest = {
      event: "accepted",
      properties: {
        session_id: change.session_id,
        file_path: vscode.workspace.asRelativePath(vscode.Uri.parse(uri)),
        source: this.getSourceForUsageTracking(
          change.is_inline,
          change.write_mode,
          change.is_inline_modify
        ),
        lines:
          change.type === "modified"
            ? change.removed.count + change.added.count
            : change.count,
      },
    };
    const usageTrackingManager = new UsageTrackingManager();
    usageTrackingManager.trackUsage(usageTrackingData);

    let range: vscode.Range;
    let value = "";
    let count = 0;

    if (change.type === "removed") {
      // Remove the old lines
      range = new vscode.Range(
        new vscode.Position(change.line, 0),
        new vscode.Position(change.line + change.count, 0)
      );
      count = change.count;
    } else if (change.type === "added") {
      // The lines are already added in the editor content, so do nothing
      count = 0;
    } else {
      // 'modified': remove old lines, replace with new
      range = new vscode.Range(
        new vscode.Position(change.removed.line, 0),
        new vscode.Position(change.added.line + change.added.count, 0)
      );
      value = change.added.value;
      count = change.removed.count;
    }

    // Perform the text edit if needed
    if (count !== 0) {
      await editor.edit((edit) => {
        edit.replace(range, value);
      });
    }

    // Re-draw
    this.drawChanges(editor, fileChange, index, count);

    // If no more changes remain, update context, remove from map, save
    if (fileChange.changes.length === 0) {
      vscode.commands.executeCommand(
        "setContext",
        "deputydev.hasChanges",
        false
      );
      this.fileChangeMap.delete(uri);
      this._onDidChange.fire({
        type: "accept",
        path: editor.document.uri.fsPath,
      });
      await this.saveDocument(editor);
    }
  }

  /**
   * Reject a single chunk.
   */
  private async rejectChange(uri: string, i?: number) {
    this.outputChannel.debug(`Reject change: ${uri}, index=${i}`);

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== uri) {
      return;
    }

    const fileChange = this.fileChangeMap.get(uri);
    if (!fileChange) {
      return;
    }

    let index: number;
    if (typeof i === "number") {
      index = i;
    } else {
      index = this.getChangeIndex(editor, fileChange);
      if (index === -1) {
        return;
      }
    }

    const change = fileChange.changes[index];

    let range: vscode.Range;
    let value = "";
    let count = 0;

    if (change.type === "removed") {
      // Already removed from the editor, so do nothing to revert
      count = 0;
    } else if (change.type === "added") {
      // Remove the newly added lines
      range = new vscode.Range(
        new vscode.Position(change.line, 0),
        new vscode.Position(change.line + change.count, 0)
      );
      count = change.count;
    } else {
      // 'modified': remove the newly added lines, restore old
      range = new vscode.Range(
        new vscode.Position(change.removed.line, 0),
        new vscode.Position(change.added.line + change.added.count, 0)
      );
      value = change.removed.value;
      count = change.added.count;
    }

    if (count !== 0) {
      await editor.edit((edit) => {
        edit.replace(range, value);
      });
    }

    this.drawChanges(editor, fileChange, index, count);

    // If no changes remain, remove from map, close or save
    if (fileChange.changes.length === 0) {
      vscode.commands.executeCommand(
        "setContext",
        "deputydev.hasChanges",
        false
      );
      this.fileChangeMap.delete(uri);
      this._onDidChange.fire({
        type: "reject",
        path: editor.document.uri.fsPath,
      });

      // If it's a real file, save it. If untitled, close.
      if (editor.document.uri.scheme === "file") {
        await this.saveDocument(editor);
      } else {
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor"
        );
      }
    }
  }

  /**
   * Accept all changes in a single file
   */
  private async acceptAllChanges(uri: vscode.Uri) {
    this.outputChannel.debug(`Accept all changes: ${uri}`);
    const fileChange = this.fileChangeMap.get(uri.toString());
    if (!fileChange) {
      return;
    }

    const editor = await vscode.window.showTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();

    let numLines = 0;
    for (const change of fileChange.changes) {
      if (change.type === "modified") {
        numLines += change.removed.count + change.added.count;
      } else {
        numLines += change.count;
      }
    }
    const session_id = fileChange.changes[0].session_id;
    const source = this.getSourceForUsageTracking(
      fileChange.changes[0].is_inline,
      fileChange.changes[0].write_mode,
      fileChange.changes[0].is_inline_modify
    );

    const usageTrackingData: UsageTrackingRequest = {
      event: "accepted",
      properties: {
        session_id: session_id,
        file_path: vscode.workspace.asRelativePath(uri),
        lines: numLines,
        source: source,
      },
    };
    const usageTrackingManager = new UsageTrackingManager();
    usageTrackingManager.trackUsage(usageTrackingData);

    for (let i = fileChange.changes.length - 1; i >= 0; i--) {
      const change = fileChange.changes[i];
      if (change.type === "added") {
        // Already in editor, do nothing
      } else if (change.type === "removed") {
        // Remove these lines from the editor
        edit.delete(
          uri,
          new vscode.Range(change.line, 0, change.line + change.count, 0)
        );
      } else {
        // 'modified': remove old lines
        edit.delete(
          uri,
          new vscode.Range(
            change.removed.line,
            0,
            change.removed.line + change.removed.count,
            0
          )
        );
      }
    }

    await vscode.workspace.applyEdit(edit);
    this.fileChangeMap.delete(uri.toString());
    this._onDidChange.fire({
      type: "accept",
      path: uri.fsPath,
    });

    vscode.commands.executeCommand("setContext", "deputydev.hasChanges", false);
    await this.saveDocument(editor);
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Reject all changes in a single file
   */
  private async rejectAllChanges(uri: vscode.Uri) {
    this.outputChannel.debug(`Reject all changes: ${uri}`);
    const fileChange = this.fileChangeMap.get(uri.toString());
    if (!fileChange) {
      return;
    }

    const editor = await vscode.window.showTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();

    for (let i = fileChange.changes.length - 1; i >= 0; i--) {
      const change = fileChange.changes[i];
      if (change.type === "added") {
        // Remove the newly added lines
        edit.delete(
          uri,
          new vscode.Range(change.line, 0, change.line + change.count, 0)
        );
      } else if (change.type === "removed") {
        // Already absent from the editor, so do nothing
      } else {
        // 'modified': remove newly added lines
        edit.delete(
          uri,
          new vscode.Range(
            change.added.line,
            0,
            change.added.line + change.added.count,
            0
          )
        );
      }
    }

    await vscode.workspace.applyEdit(edit);
    this.fileChangeMap.delete(uri.toString());
    this._onDidChange.fire({
      type: "reject",
      path: uri.fsPath,
    });

    vscode.commands.executeCommand("setContext", "deputydev.hasChanges", false);
    if (editor.document.uri.scheme === "file") {
      await this.saveDocument(editor);
    } else {
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    }
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * If the editor is dirty, clear decorations and save.
   */
  private async saveDocument(editor: vscode.TextEditor) {
    editor.setDecorations(this.deletionDecorationType, []);
    editor.setDecorations(this.insertionDecorationType, []);
    if (editor.document.isDirty) {
      await editor.document.save();
    }
  }

  /**
   * Open a diff view for a file: calculates line-based diffs and highlights them inline.
   */
  async openDiffView(
    data: { path: string; content: string },
    session_id?: number,
    write_mode?: boolean,
    is_inline?: boolean,
    is_inline_modify?: boolean
  ): Promise<void> {
    try {
      this.outputChannel.info(`opening diff view: ${data.path}`);

      // get the diff between original content and the newely received content
      const originalContent = await this.getOriginalContentToShowDiffOn(
        data.path
      );

      const computedUdiff = createTwoFilesPatch(data.path, data.path, originalContent, data.content);

      // update the fileChangeStateMap with the original and modified content from the udiff
      // initialContent is updated only when the file is opened for the first time
      this.updateFileStateInFileChangeStateMap(
        data.path,
        computedUdiff,
        originalContent
      );

      const fileChangeState = this.fileChangeStateMap.get(data.path);
      if (!fileChangeState) {
        throw new Error(`File change state not found for ${data.path}`);
      }

      // show the diff view
      let uri = vscode.Uri.file(data.path);
      // try {
      //   await vscode.workspace.fs.stat(uri);
      // } catch {
      //   // file doesn't exist => treat as untitled
      //   uri = uri.with({ scheme: "untitled" });
      // }
      // const document = await vscode.workspace.openTextDocument(uri);
      // const editor = await vscode.window.showTextDocument(document, {
      //   preview: false,
      //   preserveFocus: true,
      // });
      // const lineEol =
      //   vscode.EndOfLine.CRLF === editor.document.eol ? "\r\n" : "\n";
      const displayableUdiff = fileChangeState.currentUdiff.replace(/\r?\n/g, "\n");
      // const currentContent = editor.document.getText();
    
      // const differences = diffLines(currentContent, modifiedContent);
      // this.outputChannel.debug("diffs", differences);
      // let lineNumber = 0;
      // let combineContent = "";
      // const changes: Change[] = [];
      // let lastRemoved: RemovedChange | undefined;

      // for (const part of differences) {
      //   let currentChange: Change | undefined;

      //   if (part.removed) {
      //     lastRemoved = {
      //       type: "removed",
      //       line: lineNumber,
      //       count: part.count!,
      //       value: part.value,
      //     };
      //     // If last part is removed
      //     if (part === differences[differences.length - 1]) {
      //       currentChange = lastRemoved;
      //     }
      //   } else if (part.added) {
      //     const added: AddedChange = {
      //       type: "added",
      //       line: lineNumber,
      //       count: part.count!,
      //       value: part.value,
      //     };
      //     if (lastRemoved) {
      //       currentChange = {
      //         type: "modified",
      //         removed: lastRemoved,
      //         added,
      //       };
      //       lastRemoved = undefined;
      //     } else {
      //       currentChange = added;
      //     }
      //   } else if (lastRemoved) {
      //     // no 'added' part matched => finalize that removal
      //     currentChange = lastRemoved;
      //     lastRemoved = undefined;
      //   }

      //   if (currentChange) {
      //     currentChange.session_id = session_id;
      //     currentChange.is_inline = is_inline;
      //     currentChange.write_mode = write_mode;
      //     currentChange.is_inline_modify = is_inline_modify;
      //     changes.push(currentChange);
      //   }
      //   combineContent += part.value;
      //   lineNumber += part.count!;
      // }

      // Replace entire content with the combined text
      // const edit = new vscode.WorkspaceEdit();
      // const fullRange = new vscode.Range(
      //   new vscode.Position(0, 0),
      //   new vscode.Position(editor.document.lineCount, 0)
      // );
      // edit.replace(editor.document.uri, fullRange, displayableUdiff);
      // await vscode.workspace.applyEdit(edit);

      // this._onDidChange.fire({ type: "add", path: uri.fsPath });

      vscode.commands.executeCommand(
        "setContext",
        "deputydev.hasChanges",
        true
      );




      const displayableUdiffUri = vscode.Uri.parse(
            `deputydev-custom:${data.path.split('/').pop()}.dddiff`,
            true,
          ).with({
            query: Buffer.from(displayableUdiff).toString('base64'),
          });

      await vscode.commands.executeCommand(
        'vscode.openWith',
        displayableUdiffUri,
        'deputydev.proposedChangeEditor'
      );

      // Highlight changes visually
      // this.drawChanges(editor, { changes });

      // // ✅ Scroll to the first diff line
      // if (changes.length > 0) {
      //   const firstChange = changes[0];
      //   let line = 0;
      //   if (firstChange.type === "modified") {
      //     line = firstChange.removed.line;
      //   } else {
      //     line = firstChange.line;
      //   }
      //   const rangeToReveal = new vscode.Range(line, 0, line, 0);
      //   editor.revealRange(rangeToReveal, vscode.TextEditorRevealType.InCenter);
      // }
      // let numLines = 0;
      // for (const change of changes) {
      //   if (change.type === "modified") {
      //     numLines += change.removed.count + change.added.count;
      //   } else {
      //     numLines += change.count;
      //   }
      // }

      // if (is_inline_modify) {
      //   const usageTrackingData: UsageTrackingRequest = {
      //     event: "generated",
      //     properties: {
      //       file_path: vscode.workspace.asRelativePath(
      //         vscode.Uri.parse(data.path)
      //       ),
      //       lines: numLines,
      //       session_id: session_id,
      //       source: "inline-modify",
      //     },
      //   };
      //   const usageTrackingManager = new UsageTrackingManager();
      //   usageTrackingManager.trackUsage(usageTrackingData);
      // }

      // Log success
      this.outputChannel.debug(`Applied inline diff for ${data.path}`);
    } catch (error) {
      this.outputChannel.error(`Error applying inline diff: ${error}`);
      throw error;
    }
  }

  /**
   * Accept all changes in all tracked files.
   */
  async acceptAllFile(): Promise<void> {
    for (const uri of this.fileChangeMap.keys()) {
      await this.acceptAllChanges(vscode.Uri.parse(uri));
    }
  }

  /**
   * Reject all changes in all tracked files.
   */
  async rejectAllFile(): Promise<void> {
    for (const uri of this.fileChangeMap.keys()) {
      await this.rejectAllChanges(vscode.Uri.parse(uri));
    }
  }

  /**
   * Accept all changes for one file path
   */
  async acceptFile(path: string): Promise<void> {
    await this.acceptAllChanges(vscode.Uri.file(path));
  }

  /**
   * Reject all changes for one file path
   */
  async rejectFile(path: string): Promise<void> {
    await this.rejectAllChanges(vscode.Uri.file(path));
  }
}
