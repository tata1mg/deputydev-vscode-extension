// webview-ui/src/views/chat/codeActionPanel.tsx
import React from 'react';
import { useChatStore } from '../../stores/chatStore';
import { SnippetReference } from './snippetReference';
import { ChatReferenceSnippetItem } from '@/types';

export interface CodeBlockProps {
    language: string;
    code: string;
    file_path: string;
}

export function CodeBlock({ language, code, file_path }: CodeBlockProps) {

    const snippet: ChatReferenceSnippetItem = {
        id: 'unique-id',
        type: 'snippet',
        name: 'Snippet Name',
        file_path: file_path,
        content: code,
        language: language,
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        alert('Snippet copied to clipboard!');
    };

    const handleInsert = () => {
        console.log('Insert clicked:', code);
        // Add your insert logic here.
    };

    return (
        <div className="bg-gray-900 my-4 border border-gray-500 rounded-md w-full overflow-hidden">
            <div className="flex justify-between items-center bg-neutral-700 px-3 py-1 border-gray-500 border-b h-8 text-neutral-300 text-xs">
                <span>{language || 'plaintext'}</span>
                <div className="flex gap-2">
                    <span className=' text-neutral-300'>{file_path}</span>
                    <button
                        className="text-neutral-300 hover:text-white text-xs active:scale-90 transition-transform duration-150"
                        onClick={handleCopy}
                    >
                        Copy
                    </button>

                    <button className="text-neutral-300 hover:text-white" onClick={handleInsert}>
                        Insert
                    </button>
                </div>
            </div>
            <SnippetReference snippet={snippet} />
        </div>
    );
}
