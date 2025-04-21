import * as vscode from 'vscode';
import { DiffContentDocument } from './diffContentDocument';

export class DiffEditorProvider implements vscode.CustomEditorProvider<DiffContentDocument> {
  static readonly viewType = 'deputydev.customDiffEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

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
          undo: () => {},
          redo: () => {}
        });
      }
    });

    webviewPanel.onDidDispose(() => {
      // No-op for now
    });
  }

  private getHtmlForWebview(text: string): string {
    console.log('Generating HTML for webview with text:', text);
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    html, body {
      height: 100%;
      margin: 0;
    }
    textarea {
      width: 100%;
      height: 100%;
      font-family: monospace;
      font-size: 14px;
      padding: 10px;
      box-sizing: border-box;
      resize: none;
    }
  </style>
</head>
<body>
  <textarea id="editor">${escaped}</textarea>
  <script>
    const vscode = acquireVsCodeApi();
    const textarea = document.getElementById('editor');
    textarea.focus();
    textarea.addEventListener('input', () => {
      vscode.postMessage({ type: 'edit', text: textarea.value });
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
      delete: () => {}
    });
  }
}