import * as vscode from 'vscode';
import * as fsPromise from 'fs/promises';
import * as path from 'path';

// add TextDocumentContentProvider class
class DiffContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    return Buffer.from(uri.query, 'base64').toString('utf-8');
  }
}

export class DiffEditorViewManager {
  static readonly DiffContentProviderId = 'deputydev';

  // uri -> content
  private fileChangeSet = new Map<string, string>();

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    // diff content provider
    const diffProvider = new DiffContentProvider();
    const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
      DiffEditorViewManager.DiffContentProviderId,
      diffProvider,
    );

    this.context.subscriptions.push(
      providerRegistration,
      vscode.commands.registerCommand('deputydev.ConfirmModify', async (uri: vscode.Uri, _group: unknown) => {
        outputChannel.info(`ConfirmModify: ${uri.path}`);

        const modifiedContent = Buffer.from(uri.query, 'base64');
        const fileUri = vscode.Uri.file(uri.path);

        try {
          await vscode.workspace.fs.writeFile(fileUri, modifiedContent);
        } catch (error) {
          vscode.window.showErrorMessage(`Error writing file: ${error}`);
          outputChannel.error(`Error writing file: ${error}`);
        }

          this.fileChangeSet.delete(uri.toString());

        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

          this.outputChannel.info(
            `path: ${uri.path} modified content is written`,
          );
          vscode.window.showInformationMessage(
            `path: ${uri.path} modified content is written`,
          );
        },
      ),

      vscode.workspace.onDidCloseTextDocument((document) => {
        if (
          document.uri.scheme === DiffEditorViewManager.DiffContentProviderId
        ) {
          this.outputChannel.info(
            `Diff document closed for: ${document.uri.path}`,
          );
          this.fileChangeSet.delete(document.uri.toString());
        }
      }),
    );
  }

  async openDiffView(data: { path: string; content: string }): Promise<void> {
    this.outputChannel.info(`command write file: ${data.path}`);

    let isNewFile = false;
    try {
      await fsPromise.access(data.path, fsPromise.constants.R_OK);
    } catch (error) {
      isNewFile = true;
    }

    try {
      let originalContentBase64 = Buffer.from('').toString('base64');
      if (!isNewFile) {
        const originalContent = await fsPromise.readFile(data.path);
        originalContentBase64 = Buffer.from(originalContent).toString(
          'base64',
        );
      }
      const originalUri = vscode.Uri.parse(
        `${DiffEditorViewManager.DiffContentProviderId}:${data.path}`,
      ).with({
        query: originalContentBase64,
      });
      const modifiedUri = vscode.Uri.parse(
        `${DiffEditorViewManager.DiffContentProviderId}:${data.path}`,
      ).with({
        query: Buffer.from(data.content).toString('base64'),
      });

      const name = path.basename(data.path);

      // open diff editor
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        `${name} ${isNewFile ? 'Created' : 'Modified'}`,
        {
          preview: false,
        },
      );

      setTimeout(() => {
        const tabGroups = vscode.window.tabGroups.all;
        for (const group of tabGroups) {
          // Find tabs that match our diff URI scheme
          const diffTabs = group.tabs.filter(
            (tab) =>
              tab.input instanceof vscode.TabInputTextDiff &&
              tab.input.modified.scheme ===
              DiffEditorViewManager.DiffContentProviderId,
          );


          // get the diff editor from the tab
          const diffEditor = diffTabs.find(
            (tab) =>
              tab.input instanceof vscode.TabInputTextDiff &&
              tab.input.modified.path === data.path,
          );

          // get the content of the diff editor
          if (diffEditor) {
            const diffEditorUri = diffEditor.input as vscode.TabInputTextDiff;
            const modifiedUri = diffEditorUri.modified;
            const originalUri = diffEditorUri.original;
            this.outputChannel.info(
              `Diff editor opened for: ${modifiedUri.path} (original: ${originalUri.path})`,
            );
            this.outputChannel.info(
              `Diff editor content: ${modifiedUri.query}`,
            );
            this.outputChannel.info(
              `Diff editor original content: ${originalUri.query}`,
            );
          }
        }



        const editors = vscode.window.visibleTextEditors;
        for (const editor of editors) {
          // You can check which editor is for which document
          if (editor.document.getText().includes('Line X')) {
            // Right-side editor (modified)
            const decorationType = vscode.window.createTextEditorDecorationType({
              backgroundColor: 'rgba(255,255,0,0.3)',
              isWholeLine: true,
            });

            const line = editor.document.lineAt(1); // Line with "Line X"
            editor.setDecorations(decorationType, [line.range]);
          }
        }
      }, 500);
    } catch (error) {
      this.outputChannel.error(`Error opening diff: ${error}`);
    }

    this.fileChangeSet.set(vscode.Uri.file(data.path).toString(), data.content);
  }

  // close all diff editor with DiffContentProviderId
  private async closeAllDiffEditor(): Promise<void> {
    // Find all tab groups
    const tabGroups = vscode.window.tabGroups.all;

    for (const group of tabGroups) {
      // Find tabs that match our diff URI scheme
      const diffTabs = group.tabs.filter(
        (tab) =>
          tab.input instanceof vscode.TabInputTextDiff &&
          tab.input.modified.scheme ===
          DiffEditorViewManager.DiffContentProviderId,
      );

      // Close the matching tabs
      if (diffTabs.length > 0) {
        await vscode.window.tabGroups.close(diffTabs);
      }
    }

    // Clear the file change set after closing all editors
    this.fileChangeSet.clear();
  }

  async acceptAllFile(): Promise<void> {
    for (const [uri, content] of this.fileChangeSet.entries()) {
      await vscode.workspace.fs.writeFile(vscode.Uri.parse(uri), Buffer.from(content));
    }
    await this.closeAllDiffEditor();
  }

  async rejectAllFile(): Promise<void> {
    await this.closeAllDiffEditor();
  }

  private async closeDiffEditor(path: string): Promise<void> {
    // Find all tab groups
    const tabGroups = vscode.window.tabGroups.all;
    const targetUri = vscode.Uri.file(path).toString();

    for (const group of tabGroups) {
      // Find tabs that match our diff URI scheme and the specified path
      const diffTabs = group.tabs.filter(
        (tab) =>
          tab.input instanceof vscode.TabInputTextDiff &&
          tab.input.modified.scheme ===
          DiffEditorViewManager.DiffContentProviderId &&
          tab.input.modified.path === path,
      );

      // Close the matching tabs
      if (diffTabs.length > 0) {
        await vscode.window.tabGroups.close(diffTabs);
      }
    }

    // Remove the file from the change set
    this.fileChangeSet.delete(targetUri);
  }

  async acceptFile(path: string): Promise<void> {
    const uri = vscode.Uri.file(path);
    const content = this.fileChangeSet.get(uri.toString());

    if (content) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
      await this.closeDiffEditor(path);
    }
  }

  async rejectFile(path: string): Promise<void> {
    await this.closeDiffEditor(path);
  }
}
