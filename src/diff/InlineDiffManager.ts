// File: src/diff/InlineDiffManager.ts

import { DiffViewManager } from "./DiffManager";
import * as vscode from "vscode";
import { UsageTrackingRequest } from "../types";
import { UsageTrackingManager } from "../usageTracking/UsageTrackingManager";
import { createTwoFilesPatch } from 'diff';


type FileChangeState = {
  initialFileContent: string; // The initial content of the file before any changes. Used to revert to the original state.
  originalContent: string; // The original content based on the current udiff
  modifiedContent: string; // The modified content based on the current udiff
  currentUdiff: string; // The current udiff content
}

export class DeputyDevDiffViewManager extends DiffViewManager {
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


  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel
  ) {
    super();

    // Set initial context value
    vscode.commands.executeCommand("setContext", "deputydev.changeProposer.hasChanges", false);
  }



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
        "deputydev.changeProposer.hasChanges",
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
        "deputydev.changeProposer.hasChanges",
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

    vscode.commands.executeCommand("setContext", "deputydev.changeProposer.hasChanges", false);
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

    vscode.commands.executeCommand("setContext", "deputydev.changeProposer.hasChanges", false);
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
      // let uri = vscode.Uri.file(data.path);
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
        "deputydev.changeProposer.hasChanges",
        true
      );




      const displayableUdiffUri = vscode.Uri.from({
        scheme: 'deputydev-custom',
        query: Buffer.from(displayableUdiff).toString('base64'),
        path: `${data.path}.ddproposed`
      });

      await vscode.commands.executeCommand(
        'vscode.openWith',
        displayableUdiffUri,
        'deputydev.changeProposer'
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
