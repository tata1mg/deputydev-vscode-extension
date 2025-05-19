import * as vscode from 'vscode';
import { FileChangeStateManager } from '../../fileChangeStateManager/fileChangeStateManager';
import { ChangeProposerFsProvider } from './fsProvider/changeProposerFsProvider';
import { ChangeProposerEditor } from './editor/changeProposerEditor';

export class DeputydevChangeProposer {
  private changeProposerEditor: ChangeProposerEditor | undefined;
  constructor(
    private readonly vscodeContext: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly fileChangeStateManager: FileChangeStateManager,
  ) {}

  public init = async () => {
    this.outputChannel.info('Initializing DeputydevChangeProposer');
    this.outputChannel.info('Registering custom editor provider');
    this.changeProposerEditor = new ChangeProposerEditor(
      this.vscodeContext,
      this.outputChannel,
      this.fileChangeStateManager,
    );
    this.vscodeContext.subscriptions.push(
      vscode.workspace.registerFileSystemProvider(
        'ddproposed',
        new ChangeProposerFsProvider(this.fileChangeStateManager, this.outputChannel),
        { isReadonly: false },
      ),
    );

    this.vscodeContext.subscriptions.push(
      vscode.window.registerCustomEditorProvider(ChangeProposerEditor.viewType, this.changeProposerEditor, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }),
    );
  };

  /**
   * Open a diff view for a file: calculates line-based diffs and highlights them inline.
   */
  async openDiffView(filePath: string, repoPath: string, writeMode: boolean): Promise<void> {
    try {
      this.outputChannel.info(`opening diff view for: ${filePath}`);

      const fileChangeState = await this.fileChangeStateManager.getFileChangeState(filePath, repoPath);
      if (!fileChangeState) {
        throw new Error(`File change state not found for ${filePath}`);
      }

      const displayableUdiffUri = vscode.Uri.from({
        scheme: 'ddproposed',
        query: Buffer.from(repoPath).toString('base64'),
        path: `${filePath}`,
      });

      await vscode.commands.executeCommand('vscode.openWith', displayableUdiffUri, 'deputydev.changeProposer');
      // TODO: handle gracefully if the editor is already open
      if (!this.changeProposerEditor) {
        return;
      }
      this.changeProposerEditor.updateExistingPanel(displayableUdiffUri);
    } catch (error) {
      this.outputChannel.error(`Error applying inline diff: ${error}`);
      throw error;
    }
  }
}
