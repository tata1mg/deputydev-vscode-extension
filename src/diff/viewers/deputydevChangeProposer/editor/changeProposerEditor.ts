import * as vscode from 'vscode';
import { ChangeProposerDocument } from '../document/changeProposerDocument';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class ChangeProposerEditor implements vscode.CustomEditorProvider<ChangeProposerDocument> {
  static readonly viewType = 'deputydev.changeProposer';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.LogOutputChannel,
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
      webviewPanel.webview.html = this.getHtmlForWebview(document.content);
    };

    updateWebview();

    webviewPanel.webview.onDidReceiveMessage((message) => {
      if (message.type === 'edit') {
        document.content = message.text;
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => {},
          redo: () => {},
        });
      }
    });

    webviewPanel.onDidDispose(() => {
      // No-op for now
    });
  }

  private getHtmlForWebview(text: string): string {
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
          top: 60px;
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
        .green-line {
          background-color: rgba(35, 134, 54, 0.2); /* VSCode diff green */
        }
        .red-line {
          background-color: rgba(179, 29, 40, 0.2); /* VSCode diff red */
        }
      </style>
      <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
    </head>
    <body>
      <div id="container"></div>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
  
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
          const editor = monaco.editor.create(document.getElementById('container'), {
            value: \`${text}\`,
            language: 'plaintext',
            theme: 'vs-dark',
            automaticLayout: true
          });
  
          // Add decorations and buttons for lines starting with + and -
          const addLineDecorations = () => {
            const model = editor.getModel();
            const decorations = [];
            
            // Clear any previously added buttons
            const existingButtons = document.querySelectorAll('.button-container');
            existingButtons.forEach(button => button.remove());
  
            // Iterate over each line
            for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
              const lineText = model.getLineContent(lineNumber);
              const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
              let buttonContainer = null;
              
              if (lineText.startsWith('+')) {
                decorations.push({
                  range: new monaco.Range(lineNumber, 1, lineNumber, lineText.length + 1),
                  options: {
                    isWholeLine: true,
                    className: 'green-line'
                  }
                });
  
                // Create and position buttons at the start of the diff line
                buttonContainer = document.createElement('div');
                buttonContainer.classList.add('button-container');
                buttonContainer.style.top = \`\${lineNumber * lineHeight}px\`;
                const acceptButton = document.createElement('button');
                acceptButton.classList.add('accept-button');
                acceptButton.innerText = 'Accept';
                buttonContainer.appendChild(acceptButton);
                const rejectButton = document.createElement('button');
                rejectButton.classList.add('reject-button');
                rejectButton.innerText = 'Reject';
                buttonContainer.appendChild(rejectButton);
                document.body.appendChild(buttonContainer);
  
              } else if (lineText.startsWith('-')) {
                decorations.push({
                  range: new monaco.Range(lineNumber, 1, lineNumber, lineText.length + 1),
                  options: {
                    isWholeLine: true,
                    className: 'red-line'
                  }
                });
  
                // Create and position buttons at the start of the diff line
                buttonContainer = document.createElement('div');
                buttonContainer.classList.add('button-container');
                buttonContainer.style.top = \`\${lineNumber * lineHeight}px\`;
                const acceptButton = document.createElement('button');
                acceptButton.classList.add('accept-button');
                acceptButton.innerText = 'Accept';
                buttonContainer.appendChild(acceptButton);
                const rejectButton = document.createElement('button');
                rejectButton.classList.add('reject-button');
                rejectButton.innerText = 'Reject';
                buttonContainer.appendChild(rejectButton);
                document.body.appendChild(buttonContainer);
              }
            }
            
            editor.deltaDecorations([], decorations);
          };
  
          // Apply the line decorations and button placement
          addLineDecorations();
  
          editor.onDidChangeModelContent(() => {
            vscode.postMessage({
              type: 'edit',
              text: editor.getValue()
            });
          });
  
          // Handling button clicks
          document.addEventListener('click', (event) => {
            if (event.target && event.target.classList.contains('accept-button')) {
              vscode.postMessage({ type: 'accept' });
            } else if (event.target && event.target.classList.contains('reject-button')) {
              vscode.postMessage({ type: 'reject' });
            }
          });
        });
      </script>
    </body>
    </html>`;
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
