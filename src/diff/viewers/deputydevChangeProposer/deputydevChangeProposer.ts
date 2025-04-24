import * as vscode from "vscode";
import { FileChangeStateManager } from "../../fileChangeStateManager/fileChangeStateManager";
import { ChangeProposerFsProvider } from "./fsProvider/changeProposerFsProvider";
import { ChangeProposerEditor } from "./editor/changeProposerEditor";


export class DeputydevChangeProposer {

  constructor(
    private readonly vscodeContext: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly fileChangeStateManager: FileChangeStateManager,
  ) {
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
    uri: string
  ): Promise<void> {
    try {
      vscode.commands.executeCommand("setContext", "deputydev.changeProposer.hasChanges", false);
      this.outputChannel.info(`opening diff view for: ${uri}`);

      const fileChangeState = this.fileChangeStateManager.getFileChangeState(uri);
      if (!fileChangeState) {
        throw new Error(`File change state not found for ${uri}`);
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
        path: `${uri}.ddproposed`
      });

      await vscode.commands.executeCommand(
        'vscode.openWith',
        displayableUdiffUri,
        'deputydev.changeProposer'
      );
    } catch (error) {
      this.outputChannel.error(`Error applying inline diff: ${error}`);
      throw error;
    }
  }
}
