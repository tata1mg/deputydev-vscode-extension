import * as vscode from 'vscode';
import { ChangeProposerDocument } from '../document/changeProposerDocument';
import { getUri } from '../../../../utilities/getUri';
import { FileChangeStateManager } from '../../../fileChangeStateManager/fileChangeStateManager';

export class ChangeProposerEditor implements vscode.CustomEditorProvider<ChangeProposerDocument> {
  static readonly viewType = 'deputydev.changeProposer';

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
    console.log('Opening custom document:', uri.toString());
    const document = new ChangeProposerDocument(uri);
    await document.init(); // load file content
    console.log('Document content loaded:', document.content);
    return document;
  }

  async resolveCustomEditor(
    document: ChangeProposerDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    console.log('Resolving custom editor for document:', document.uri.toString());

    webviewPanel.title = 'DeputyDev Change Proposer';
    webviewPanel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'dd_logo_light.png');
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    this.outputChannel.info(`Opening custom editor for: ${document.uri.toString()}`);
    this.outputChannel.info(`Document content: ${document.content}`);

    const updateWebview = () => {
      webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    };

    updateWebview();

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'get-initial-content': {
          const initialContent = document.content;
          webviewPanel.webview.postMessage({
            id: message.id,
            command: 'result',
            data: initialContent,
          });
          break;
        }
        case 'accept-change': {
          const line = message.data.line;
          const newContent = await this.fileChangeStateManager.acceptChangeAtLine(
            document.filePath,
            document.repoPath,
            line,
          );
          if (newContent) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
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
          if (newContent) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
            });
          }
          break;
        }
        case 'accept-all-changes': {
          const newContent = await this.fileChangeStateManager.acceptAllChangesInFile(
            document.filePath,
            document.repoPath,
          );
          if (newContent) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
            });
          }
          break;
        }
        case 'reject-all-changes': {
          const newContent = await this.fileChangeStateManager.rejectAllChangesInFile(
            document.filePath,
            document.repoPath,
          );
          if (newContent) {
            document.content = newContent;
            webviewPanel.webview.postMessage({
              id: message.id,
              command: 'result',
              data: newContent,
            });
          }
          break;
        }
        default: {
          console.log('Unknown message received:', message);
          break;
        }
      }
    });

    webviewPanel.onDidDispose(() => {
      // No-op for now
    });
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

  saveCustomDocument(): Thenable<void> {
    return Promise.resolve(); // no-op for in-memory
  }

  saveCustomDocumentAs(document: ChangeProposerDocument, destination: vscode.Uri): Thenable<void> {
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
