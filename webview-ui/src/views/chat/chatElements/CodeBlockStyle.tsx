// webview-ui/src/views/chat/snippetReference.tsx
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';


export type ChatReferenceSnippetItem = {
  content: string;
  language?: string;
  file_path?: string;
};

export function SnippetReference({ snippet }: { snippet: ChatReferenceSnippetItem }) {
  return (
    <SyntaxHighlighter
      language={snippet.language || 'code'}
      style={dracula}
      customStyle={{
        padding: '16px',
        borderRadius: '0 0 8px 8px',
        margin: 0,
        fontSize: '12px',
        fontFamily: 'var(--vscode-editor-font-family)'
      }}
    >
      {snippet.content}
    </SyntaxHighlighter>
  );
}
