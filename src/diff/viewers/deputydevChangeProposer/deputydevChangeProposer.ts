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

      // Log success
      this.outputChannel.debug(`Applied inline diff for ${data.path}`);
    } catch (error) {
      this.outputChannel.error(`Error applying inline diff: ${error}`);
      throw error;
    }
  }

}
