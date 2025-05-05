import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monacoEditor from 'monaco-editor';
import { callCommand } from './vscode';

const App: React.FC = () => {
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    const loadContent = async () => {
      const result = await callCommand('get-initial-content', {});
      if (typeof result === 'string') {
        setContent(result);
      }
    };
    loadContent();
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    decorateEditor(editor, monaco);
  };
  

  const decorateEditor = (editor: monacoEditor.editor.IStandaloneCodeEditor, monaco: typeof monacoEditor) => {
    editorRef.current = editor;
    const model = editor.getModel();
    if (!model) return;

    const lines = model.getLinesContent();
    const decorations: monacoEditor.editor.IModelDeltaDecoration[] = [];

    const ACCEPT_ICON = 'PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiM3N2ZkOGUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS00LjI5IDEwLjI5TDguNzEgMTQuNzFsMi44NS0yLjg1IDQuNzEgNC43MS0xLjQxIDEuNDFMMTAuNzEgMTIuMjl6Ii8+PC9zdmc+';
    const REJECT_ICON = 'PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9IiNlMjQzNDMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTEuNDEgMTMuNDFMMTIgMTMuNDFsLTMuNDEgMy40MS0xLjQxLTEuNDFMMTAuNTkgMTIgNy4xOCA4LjU5bDEuNDEtMS40MUwxMiAxMC41OWwzLjQxLTMuNDFsMS40MSAxLjQxTDEzLjQxIDEybDMuNDEgMy40MS0xLjQxIDEuNDF6Ii8+PC9zdmc+';

    const createContentWidget = (line: number): monacoEditor.editor.IContentWidget => {
      const widgetId = `diff-buttons-${line}`;
    
      const domNode = document.createElement('span');
      domNode.className = 'inline-buttons';
    
      const createButton = (label: string, base64: string, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.className = 'diff-action-button';
        const img = document.createElement('img');
        img.src = `data:image/svg+xml;base64,${base64}`;
        img.width = 16;
        img.height = 16;
        img.alt = label;
        const text = document.createElement('span');
        text.textContent = ` ${label}`;
        btn.appendChild(img);
        btn.appendChild(text);
        btn.onclick = onClick;
        return btn;
      };
    
      const acceptBtn = createButton('Accept', ACCEPT_ICON, () => {

        const handleAcceptChange = async (line: number) => {
          if (!editorRef.current) return;
          try {
            const newContent = await callCommand('accept-change', { line });
            if (typeof newContent === 'string') {
              editorRef.current.setValue(newContent);
            }
          } catch (err) {
            console.error('Failed to accept change:', err);
          }
        };
        handleAcceptChange(line);
        // Re-decorate the editor after accepting
        if (!editorRef.current) return;
        decorateEditor(editorRef.current, monaco);
        // disable the button after accepting
        acceptBtn.disabled = true;
        console.log(`✅ Accepted change at line ${line}`);
      });
      const rejectBtn = createButton('Reject', REJECT_ICON, () => alert(`❌ Rejected change at line ${line}`));
    
      domNode.appendChild(acceptBtn);
      domNode.appendChild(rejectBtn);
    
      return {
        getId: () => widgetId,
        getDomNode: () => domNode,
        getPosition: () => ({
          position: { lineNumber: line, column: Number.MAX_SAFE_INTEGER },
          preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
        }),
      };
    };

    const createOverlayWidget = (): monacoEditor.editor.IOverlayWidget => {
      const widgetId = 'top-right-actions';
    
      const domNode = document.createElement('div');
      domNode.className = 'top-right-buttons';
    
      const createButton = (label: string, base64: string, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.className = 'diff-action-button';
        const img = document.createElement('img');
        img.src = `data:image/svg+xml;base64,${base64}`;
        img.width = 8;
        img.height = 8;
        img.alt = label;
        const text = document.createElement('span');
        text.textContent = ` ${label}`;
        btn.appendChild(img);
        btn.appendChild(text);
        btn.onclick = onClick;
        return btn;
      };
    
      const acceptAll = createButton('Accept All', ACCEPT_ICON, () =>
        alert('✅ Accepted all changes')
      );
      const rejectAll = createButton('Reject All', REJECT_ICON, () =>
        alert('❌ Rejected all changes')
      );
    
      domNode.appendChild(acceptAll);
      domNode.appendChild(rejectAll);
    
      return {
        getId: () => widgetId,
        getDomNode: () => domNode,
        getPosition: () => ({
          preference: monaco.editor.OverlayWidgetPositionPreference.TOP_RIGHT_CORNER,
        }),
      };
    };

    editor.addOverlayWidget(createOverlayWidget());

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      if (line.startsWith('+')) {
        decorations.push({
          range: new monaco.Range(lineNum, 1, lineNum, 1),
          options: { isWholeLine: true, className: 'plus-line' },
        });
      } else if (line.startsWith('-')) {
        decorations.push({
          range: new monaco.Range(lineNum, 1, lineNum, 1),
          options: { isWholeLine: true, className: 'minus-line' },
        });
      }

      const prev = i > 0 ? lines[i - 1] : '';
      const isBlockStart = (line.startsWith('+') || line.startsWith('-')) && !(prev.startsWith('+') || prev.startsWith('-'));
      if (isBlockStart) {
        const widget = createContentWidget(lineNum);
        editor.addContentWidget(widget);
      }
    }

    editor.deltaDecorations([], decorations);
  };

  return (
    <div style={{ height: '100vh' }}>
      <Editor
        height="100%"
        language="python"
        value={content}
        theme="vs-dark"
        options={{ glyphMargin: true }}
        onMount={handleEditorDidMount}
      />
      <style>{`
        .plus-line {
          background-color: rgba(0, 255, 0, 0.15);
        }
        .minus-line {
          background-color: rgba(255, 0, 0, 0.15);
        }
        .inline-buttons {
          margin-left: 8px;
          display: inline-flex; /* Keeps buttons side by side */
          gap: 4px;
          background: #1e1e1e;
          padding: 2px 4px; /* Reduced padding for vertical space */
          border: 1px solid #444;
          border-radius: 4px;
          align-items: center;
          white-space: nowrap;
        }
        .diff-action-button {
          display: inline-flex; /* Ensures buttons are inline */
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: #ddd;
          font-size: 10px; /* Smaller font size for compactness */
          cursor: pointer;
          padding: 2px 6px; /* Further reduced padding */
          border-radius: 4px;
          transition: background 0.3s, color 0.3s, transform 0.1s ease;
          min-width: 60px; /* Reduced min-width */
          height: 18px; /* Reduced height */
        }

        .diff-action-button img {
          vertical-align: middle;
          width: 8px; /* Reduced icon size */
          height: 8px;
        }

        .diff-action-button:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .diff-action-button:active {
          transform: scale(0.95); /* Slight shrink effect */
        }

      .top-right-buttons {
        display: flex;
        gap: 6px;
        background: #1e1e1e;
        padding: 4px 6px;
        border: 1px solid #444;
        border-radius: 6px;
        align-items: center;
        z-index: 100;
      }

      .top-right-buttons .diff-action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        background: transparent;
        border: none;
        color: #ddd;
        font-size: 10px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: background 0.3s, color 0.3s, transform 0.1s ease;
        min-width: 60px;
        height: 18px;
      }

      .top-right-buttons .diff-action-button:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }

      .top-right-buttons .diff-action-button:active {
        transform: scale(0.95);
      }
      `}</style>
    </div>
  );
};

export default App;
