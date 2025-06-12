import * as vscode from 'vscode';
import { ChangeProposerDocument } from '../document/changeProposerDocument';
import { getUri } from '../../../../utilities/getUri';
import { FileChangeStateManager } from '../../../fileChangeStateManager/fileChangeStateManager';
import * as path from 'path';
import { CancellationToken } from 'vscode';

export class ChangeProposerEditor implements vscode.CustomEditorProvider<ChangeProposerDocument> {
  static readonly viewType = 'deputydev.changeProposer';
  private document: ChangeProposerDocument | undefined;
  private readonly panels = new Map<string, vscode.WebviewPanel>(); // Track open panels

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel,
    private readonly fileChangeStateManager: FileChangeStateManager,
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<ChangeProposerDocument> {
    const document = new ChangeProposerDocument(uri);
    await document.init(); // load file content
    this.document = document;
    return document;
  }

  private getMonacoThemeKind(vscodeTheme: vscode.ColorThemeKind): string {
    switch (vscodeTheme) {
      case vscode.ColorThemeKind.Light:
        return 'vs';
      case vscode.ColorThemeKind.Dark:
        return 'vs-dark';
      case vscode.ColorThemeKind.HighContrastLight:
        return 'hc-light';
      case vscode.ColorThemeKind.HighContrast:
        return 'hc-black';
      default:
        return 'vs-dark';
    }
  }

  async resolveCustomEditor(
    document: ChangeProposerDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const key = document.uri.toString();
    this.panels.set(key, webviewPanel);
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    vscode.window.onDidChangeActiveColorTheme((e) => {
      const theme = this.getMonacoThemeKind(e.kind);

      // Send the new theme information to the webview
      if (webviewPanel) {
        webviewPanel.webview.postMessage({
          command: 'set-theme',
          theme: theme,
        });
      }
    });

    this.outputChannel.info(`Opening custom editor for: ${document.uri.toString()}`);

    const updateWebview = () => {
      webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    };

    updateWebview();

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      const key = document.uri.toString();
      const selectedPanel = this.panels.get(key);
      if (!selectedPanel) {
        this.outputChannel.error('No panel found for message');
        return;
      }
      // message token set
      const cancellationToken = new vscode.CancellationTokenSource();
      switch (message.command) {
        case 'get-latest-content': {
          const initialContent = await this.fileChangeStateManager.getFileChangeState(
            document.filePath,
            document.repoPath,
          );
          document.content = initialContent?.currentUdiff || document.content;
          this.outputChannel.info(`Sending initial content to webview: ${document.content}`);

          webviewPanel.webview.postMessage({
            id: message.id,
            command: 'result',
            data: {
              content: document.content,
              filePath: document.filePath,
              repoPath: document.repoPath,
              language: document.language,
              theme: this.getMonacoThemeKind(vscode.window.activeColorTheme.kind),
            },
          });

          // save the document if file change state is in write mode
          if (initialContent?.writeMode) {
            await this.saveCustomDocument(document, message.token);
          }
          break;
        }
        case 'accept-change': {
          const line = message.data.line;
          const newContent = await this.fileChangeStateManager.acceptChangeAtLine(
            document.filePath,
            document.repoPath,
            line,
          );
          if (newContent !== null && newContent !== undefined) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
            });
          }
          await this.saveCustomDocument(document, cancellationToken.token);
          // if there is no line with changes now, close the editor
          const newContentLineEol = newContent.includes('\r\n') ? '\r\n' : '\n';
          const newContentLines = newContent.split(newContentLineEol);
          const hasChanges = newContentLines.some((line) => line.startsWith('+') || line.startsWith('-'));
          if (!hasChanges) {
            this.fileChangeStateManager.finalizeFileChangeState(document.filePath, document.repoPath);
            selectedPanel.dispose();
            this.panels.delete(key);
            const originalFileUri = vscode.Uri.file(path.join(document.repoPath, document.filePath));
            await vscode.window.showTextDocument(originalFileUri, {
              preview: false,
            });
          }
          break;
        }
        case 'reject-change': {
          const line = message.data.line;
          const newContent = await this.fileChangeStateManager.rejectChangeAtLine(
            document.filePath,
            document.repoPath,
            line,
          );
          if (newContent !== null && newContent !== undefined) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
            });
          }
          await this.saveCustomDocument(document, cancellationToken.token);
          // if there is no line with changes now, close the editor
          const newContentLineEol = newContent.includes('\r\n') ? '\r\n' : '\n';
          const newContentLines = newContent.split(newContentLineEol);
          const hasChanges = newContentLines.some((line) => line.startsWith('+') || line.startsWith('-'));
          if (!hasChanges) {
            this.fileChangeStateManager.finalizeFileChangeState(document.filePath, document.repoPath);
            selectedPanel.dispose();
            this.panels.delete(key);
            const originalFileUri = vscode.Uri.file(path.join(document.repoPath, document.filePath));
            await vscode.window.showTextDocument(originalFileUri, {
              preview: false,
            });
          }
          break;
        }
        case 'accept-all-changes': {
          const newContent = await this.fileChangeStateManager.acceptAllChangesInFile(
            document.filePath,
            document.repoPath,
          );
          if (newContent !== null && newContent !== undefined) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
            });
            // open the original file in vscode native editor
            const originalFileUri = vscode.Uri.file(path.join(document.repoPath, document.filePath));
            await vscode.window.showTextDocument(originalFileUri, {
              preview: false,
            });
            await this.saveCustomDocument(document, cancellationToken.token);

            this.fileChangeStateManager.finalizeFileChangeState(document.filePath, document.repoPath);

            // close this editor
            selectedPanel.dispose();
            this.panels.delete(key);
          }
          break;
        }
        case 'reject-all-changes': {
          const newContent = await this.fileChangeStateManager.rejectAllChangesInFile(
            document.filePath,
            document.repoPath,
          );
          if (newContent !== null && newContent !== undefined) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
            });
            // open the original file in vscode native editor
            const originalFileUri = vscode.Uri.file(path.join(document.repoPath, document.filePath));
            await vscode.window.showTextDocument(originalFileUri, {
              preview: false,
            });
            await this.saveCustomDocument(document, cancellationToken.token);

            this.fileChangeStateManager.finalizeFileChangeState(document.filePath, document.repoPath);
            // close this editor
            selectedPanel.dispose();
            this.panels.delete(key);
          }
          break;
        }
        case 'content-changed': {
          const currentEditorContent = message.data.content;
          const newContent = await this.fileChangeStateManager.changeUdiffContent(
            document.filePath,
            document.repoPath,
            currentEditorContent,
          );
          document.content = newContent;
          webviewPanel.webview.postMessage({
            id: message.id,
            command: 'result',
            data: newContent,
          });
          // set the document as dirty
          this._onDidChangeCustomDocument.fire({
            document: document,
            undo: () => {},
            redo: () => {},
          });
          break;
        }
        default: {
          console.log('Unknown message received:', message);
          break;
        }
      }
    });

    webviewPanel.onDidDispose(() => {
      // Remove the document from the fileChangeStateManager
      // this.fileChangeStateManager.removeFileChangeState(document.filePath, document.repoPath);

      const closeFunction = async () => {
        this.outputChannel.info(`Closing custom editor for: ${document.uri.toString()}`);
        const cancellationToken = new vscode.CancellationTokenSource();
        await this.saveCustomDocument(document, cancellationToken.token);
        for (const group of vscode.window.tabGroups.all) {
          for (const tab of group.tabs) {
            if (tab.input instanceof vscode.TabInputCustom && tab.input.uri.toString() === document.uri.toString()) {
              vscode.window.tabGroups.close(tab);
            }
          }
        }
      };

      closeFunction().catch((error) => {
        this.outputChannel.error(`Error closing custom editor: ${error}`);
      });
    });
  }

  // Helper to update an existing panel
  public updateExistingPanel(uri: vscode.Uri): void {
    const key = uri.toString();
    const panel = this.panels.get(key);
    if (panel) {
      panel.webview.postMessage({
        command: 'refresh-content',
        data: {},
      });
    }
  }

  // Dispose existing panels
  public disposeExistingPanel(uri: vscode.Uri): void {
    const key = uri.toString();
    const panel = this.panels.get(key);
    if (panel) {
      panel.dispose();
      this.panels.delete(key);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, this.context.extensionUri, [
      'webviews',
      'changeProposer',
      'build',
      'assets',
      'index.css',
    ]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, this.context.extensionUri, [
      'webviews',
      'changeProposer',
      'build',
      'assets',
      'index.js',
    ]);

    return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
            <title>AI Code Assist</title>
          </head>
          <body>
            <div id="root"></div>
            <script>
            </script>
            <script type="module" src="${scriptUri}"></script>
          </body>
        </html>
      `;
  }

  // --- Required interface methods (with minimal implementations) ---
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<ChangeProposerDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  saveCustomDocument(document: ChangeProposerDocument, cancellation: CancellationToken): Thenable<void> {
    return vscode.workspace.fs.writeFile(document.uri, Buffer.from(document.content, 'utf-8'));
  }

  saveCustomDocumentAs(document: ChangeProposerDocument, destination: vscode.Uri): Thenable<void> {
    if (!document) {
      return Promise.reject(new Error('No document to save'));
    }
    return vscode.workspace.fs.writeFile(destination, Buffer.from(document.content, 'utf-8'));
  }

  revertCustomDocument(): Thenable<void> {
    return Promise.resolve(); // no disk content to revert
  }

  backupCustomDocument(): Thenable<vscode.CustomDocumentBackup> {
    return Promise.resolve({
      id: 'backup',
      delete: () => {},
    });
  }
}
