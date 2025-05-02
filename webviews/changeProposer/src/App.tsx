import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monacoEditor from 'monaco-editor';

const App: React.FC = () => {
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    const model = editor.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();

    const decorations = Array.from({ length: lineCount }).map((_, i) => ({
      range: new monaco.Range(i + 1, 1, i + 1, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName: 'myGlyphMarginClass',
        glyphMarginHoverMessage: { value: 'Click this line action' },
      },
    }));

    editor.deltaDecorations([], decorations);

    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) {
          alert(`Action triggered for line ${line}`);
        }
      }
    });
  };

  return (
    <div style={{ height: '100vh' }}>
      <Editor
        height="100%"
        defaultLanguage="javascript"
        defaultValue={`// line 1\n// line 2\n// line 3`}
        theme="vs-dark"
        options={{ glyphMargin: true }}
        onMount={handleEditorDidMount}
      />
      <style>{`
        .myGlyphMarginClass {
          background: url('/button-icon.svg') no-repeat center center;
          background-size: 16px;
          width: 16px;
          height: 16px;
        }
      `}</style>
    </div>
  );
};

export default App;
