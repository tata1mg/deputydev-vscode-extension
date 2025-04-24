// File: src/diff/InlineDiffManager.ts

import { DiffViewManager } from "../../DiffManager";
import * as vscode from "vscode";
import { createTwoFilesPatch } from 'diff';
import { FileChangeStateManager } from "../../fileChangeStateManager/fileChangeStateManager";


export class DeputydevChangeProposer extends DiffViewManager {
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
    private readonly fileChangeStateManager: FileChangeStateManager,
  ) {
    super();

    // Set initial context value
    vscode.commands.executeCommand("setContext", "deputydev.changeProposer.hasChanges", false);
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
