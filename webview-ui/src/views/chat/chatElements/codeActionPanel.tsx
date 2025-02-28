// webview-ui/src/views/chat/codeActionPanel.tsx
import { SnippetReference } from "./CodeBlockStyle";
export interface CodeActionPanelProps {
  language: string;
  filepath?: string;
  is_diff?: boolean;
  content: string;
  inline: boolean;
}

export function CodeActionPanel({ language, filepath, is_diff, content, inline }: CodeActionPanelProps) {
  const combined = { language, filepath, is_diff, content, inline };
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert('Code copied to clipboard!');
  };

  const handleInsert = () => {
    console.log('Insert clicked:', content);
    // Add your insert logic here.
  };

  // Create a snippet-like object for compatibility with SnippetReference component
  const snippet = {
    language,
    path: filepath,
    is_diff,
    content
  };

  return (
    <div className="bg-gray-900 border border-gray-500 rounded-md w-full overflow-hidden">
      <div className="flex justify-between items-center bg-neutral-700 px-3 py-1 border-gray-500 border-b h-8 text-neutral-300 text-xs">
        <span>{language || 'plaintext'}</span>
        <div className="flex gap-2">
          <button
            className="text-neutral-300 hover:text-white text-xs active:scale-90 transition-transform duration-150"
            onClick={handleCopy}
          >
            Copy
          </button>

          {/* <button className="text-neutral-300 hover:text-white" onClick={handleInsert}>
            Insert
          </button> */}
        </div>
      </div>
      <SnippetReference snippet={combined} />
    </div>
  );
}