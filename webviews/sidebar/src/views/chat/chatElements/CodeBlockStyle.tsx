import { useThemeStore } from '@/stores/useThemeStore';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

export type ChatReferenceSnippetItem = {
  content: string;
  language?: string;
  maxHeight?: number;
};

export function SnippetReference({ snippet }: { snippet: ChatReferenceSnippetItem }) {
  const { themeKind } = useThemeStore();

  const snippetStyle =
    themeKind === 'light' || themeKind === 'high-contrast-light' ? duotoneLight : dracula;

  const customStyle = {
    padding: '16px',
    margin: 0,
    fontSize: 'var(--vscode-font-size)',
    fontWeight: 'var(--vscode-font-weight)',
    fontFamily: 'var(--vscode-editor-font-family)',
    backgroundColor: 'var(--vscode-editor-background)',
    ...(snippet.maxHeight && {
      maxHeight: snippet.maxHeight,
      overflow: 'auto',
    }),
  };

  return (
    <SyntaxHighlighter
      language={snippet.language || 'code'}
      style={snippetStyle}
      customStyle={customStyle}
    >
      {snippet.content}
    </SyntaxHighlighter>
  );
}
