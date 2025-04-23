import * as vscode from 'vscode';
import { DiffContentDocument } from '../diffContentDocument';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class DiffEditorProvider implements vscode.CustomEditorProvider<DiffContentDocument> {
  static readonly viewType = 'deputydev.changeProposer';

  constructor(private readonly context: vscode.ExtensionContext) { }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<DiffContentDocument> {
    console.log('Opening custom document:', uri.toString());
    const document = new DiffContentDocument(uri);
    await document.init(); // load file content
    console.log('Document content loaded:', document.content);
    return document;
  }

  async resolveCustomEditor(
    document: DiffContentDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {

    console.log('Resolving custom editor for document:', document.uri.toString());

    webviewPanel.title = 'DeputyDev Change Proposer';
    webviewPanel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'dd_logo_light.png');
    webviewPanel.webview.options = {
      enableScripts: true
    };

    const updateWebview = () => {
      webviewPanel.webview.html = this.getHtmlForWebview(document.content);
    };

    updateWebview();

    webviewPanel.webview.onDidReceiveMessage(message => {
      if (message.type === 'edit') {
        document.content = message.text;
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => { },
          redo: () => { }
        });
      }
    });

    webviewPanel.onDidDispose(() => {
      // No-op for now
    });
  }

  private getHtmlForWebview(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`/g, '\\`'); // Escape backticks

    const nonce = getNonce();

    return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <style>
      html, body, #container {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      .button-container {
        position: absolute;
        z-index: 1000;
        display: flex;
        gap: 10px;
        top: 60px; /* Position on 3rd line, adjust based on line height */
      }
      .accept-button, .reject-button {
        padding: 5px 10px;
        border: none;
        background-color: #007acc;
        color: white;
        font-size: 12px;
        border-radius: 4px;
        cursor: pointer;
      }
      .accept-button:hover, .reject-button:hover {
        background-color: #005a9e;
      }
    </style>
    <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
  </head>
  <body>
    <div id="container"></div>
    <div class="button-container">
      <button class="accept-button">Accept</button>
      <button class="reject-button">Reject</button>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
  
      require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
      require(['vs/editor/editor.main'], function () {
        const editor = monaco.editor.create(document.getElementById('container'), {
          value: \`${escaped}\`,
          language: 'plaintext',
          theme: 'vs-dark',
          automaticLayout: true
        });
  
        editor.onDidChangeModelContent(() => {
          vscode.postMessage({
            type: 'edit',
            text: editor.getValue()
          });
        });
  
        // Handling button clicks
        document.querySelector('.accept-button').addEventListener('click', () => {
          vscode.postMessage({ type: 'accept' });
        });
  
        document.querySelector('.reject-button').addEventListener('click', () => {
          vscode.postMessage({ type: 'reject' });
        });
      });
    </script>
  </body>
  </html>`;
  }


  // --- Required interface methods (with minimal implementations) ---
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<DiffContentDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  saveCustomDocument(): Thenable<void> {
    return Promise.resolve(); // no-op for in-memory
  }

  saveCustomDocumentAs(
    document: DiffContentDocument,
    destination: vscode.Uri
  ): Thenable<void> {
    return vscode.workspace.fs.writeFile(destination, Buffer.from(document.content, 'utf-8'));
  }

  revertCustomDocument(): Thenable<void> {
    return Promise.resolve(); // no disk content to revert
  }

  backupCustomDocument(): Thenable<vscode.CustomDocumentBackup> {
    return Promise.resolve({
      id: 'backup',
      delete: () => { }
    });
  }
}