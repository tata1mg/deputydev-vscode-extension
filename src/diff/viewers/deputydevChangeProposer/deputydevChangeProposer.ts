import { DiffViewManager } from "../../diffManagerOld";
import * as vscode from "vscode";
import { createTwoFilesPatch } from 'diff';
import { FileChangeStateManager } from "../../fileChangeStateManager/fileChangeStateManager";
import { ChangeProposerFsProvider } from "./fsProvider/changeProposerFsProvider";
import { ChangeProposerEditor } from "./editor/changeProposerEditor";


export class DeputydevChangeProposer extends DiffViewManager {

  constructor(
    private readonly vscodeContext: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly fileChangeStateManager: FileChangeStateManager,
  ) {
    super();
  }


  public init = async () => {
    this.outputChannel.info("Initializing DeputydevChangeProposer");
    this.outputChannel.info("Registering custom editor provider");
    this.vscodeContext.subscriptions.push(
      vscode.workspace.registerFileSystemProvider('deputydev-custom', new ChangeProposerFsProvider(), { isReadonly: false })
    );


    this.vscodeContext.subscriptions.push(
      vscode.window.registerCustomEditorProvider(
        ChangeProposerEditor.viewType,
        new ChangeProposerEditor(this.vscodeContext),
        {
          webviewOptions: {
            retainContextWhenHidden: true
          },
          supportsMultipleEditorsPerDocument: false
        }
      )
    );
  }


  /**
   * Open a diff view for a file: calculates line-based diffs and highlights them inline.
   */
  async openDiffView(
    data: { path: string; content: string },
  ): Promise<void> {
    try {
      vscode.commands.executeCommand("setContext", "deputydev.changeProposer.hasChanges", false);
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
