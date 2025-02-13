// webview-ui/src/views/chat/codeActionPanel.tsx
import React from 'react';
import { useAnthropicChatStore } from '../../stores/anthropicChatStore';
import { SnippetReference } from './snippetReference';

export interface CodeActionPanelProps {
  inline?: boolean;
  snippetId: string;
}

export function CodeActionPanel({ inline = false, snippetId }: CodeActionPanelProps) {
  const snippet = useAnthropicChatStore(
    (state) => state.detectedSnippets[snippetId]
  );

  if (!snippet) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet.content);
    alert('Snippet copied to clipboard!');
  };

  const handleInsert = () => {
    console.log('Insert clicked:', snippet.content);
    // Add your insert logic here.
  };

  return (
    <div className="bg-gray-900 my-4 border border-gray-500 rounded-md w-full overflow-hidden">
      <div className="flex justify-between items-center bg-neutral-700 px-3 py-1 border-gray-500 border-b h-8 text-neutral-300 text-xs">
        <span>{snippet.language || 'plaintext'}</span>
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
      <SnippetReference snippet={snippet} />
    </div>
  );
}
