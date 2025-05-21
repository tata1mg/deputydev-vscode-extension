import { useThemeStore } from '@/stores/useThemeStore';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export type ChatReferenceSnippetItem = {
  content: string;
  language?: string;
};

export function SnippetReference({ snippet }: { snippet: ChatReferenceSnippetItem }) {
  const { themeKind } = useThemeStore();

  const snippetStyle =
    themeKind === 'light' || themeKind === 'high-contrast-light' ? duotoneLight : dracula;
  return (
    <SyntaxHighlighter
      language={snippet.language || 'code'}
      style={snippetStyle}
      customStyle={{
        padding: '16px',
        margin: 0,
        fontSize: 'var(--vscode-font-size)',
        fontWeight: 'var(--vscode-font-weight)',
        fontFamily: 'var(--vscode-editor-font-family)',
        backgroundColor: 'var(--vscode-editor-background)',
      }}
    >
      {snippet.content}
    </SyntaxHighlighter>
  );
}
