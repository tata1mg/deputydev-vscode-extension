import React, { useRef, useState, useEffect } from 'react';
import { useAnthropicChatStore } from '../../stores/anthropicChatStore';
import { CodeActionPanel } from './codeActionPanel';
import { CircleUserRound } from 'lucide-react';
import { EnterIcon } from '../../components/ui/enterIcon';
import Markdown from 'react-markdown';
import { AnalyzedCodeItem, SearchedCodebase } from './AnalysisChips';

export function AnthropicChat() {
  const {
    messages,
    isLoading,
    mode,
    sendChatMessage,
    sendWriteMessage,
    cancelChat,
    setMode,
  } = useAnthropicChatStore();
  const [userInput, setUserInput] = useState('');
  const [chipStatus, setChipStatus] = useState<'idle' | 'in-progress' | 'done' | 'error'>('idle');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'in-progress' | 'done'>('idle');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-resize the textarea to fit its content (min 70px, max 300px)
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    if (!userInput.trim()) return;
    if (mode === 'chat') {
      await sendChatMessage(userInput.trim());
    } else {
      await sendWriteMessage(userInput.trim());
    }
    setUserInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '70px';
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    // The container takes the full viewport height.
    <div className="flex flex-col h-full">
      {/* 
        Messages area:
        - flex-grow fills the available vertical space above the input layer.
        - overflow-auto enables scrolling.
        - space-y-4 adds a vertical gap between each message.
      */}
      <div className="flex-grow space-y-4 py-2 overflow-auto">
        {messages.map((m, idx) => {
          if (m.role === 'user') {
            return (
              <div key={idx} className="flex items-center gap-2">
                <CircleUserRound className="text-neutral-400" size={18} />
                <span className="text-white">{m.content}</span>
              </div>
            );
          } else {
            // For assistant messages, replace inline code snippet markers with CodeActionPanel components.
            // Non-code parts are rendered using Markdown.
            const regex = /\[\[CODE_SNIPPET_([a-zA-Z0-9-_]+)\]\]/g;
            const parts: (string | { snippetId: string })[] = [];
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(m.content)) !== null) {
              if (match.index > lastIndex) {
                parts.push(m.content.substring(lastIndex, match.index));
              }
              parts.push({ snippetId: match[1] });
              lastIndex = match.index + match[0].length;
            }
            if (lastIndex < m.content.length) {
              parts.push(m.content.substring(lastIndex));
            }
            return (
              <div key={idx} className="text-white">
                {parts.map((part, index) =>
                  typeof part === 'string' ? (
                    // Render non-code parts with Markdown.
                    <Markdown key={index} components={{ p: 'span' }}>
                      {part}
                    </Markdown>
                  ) : (
                    <CodeActionPanel key={index} snippetId={part.snippetId} inline={true} />
                  )
                )}
              </div>
            );
          }
        })}
        {/* Invisible marker to scroll into view */}
        <div ref={messagesEndRef} />
      </div>

      {/*
        Input Layer:
        - Placed outside the scrollable messages area.
        - The border-top visually separates it.
        - It always stays at the bottom of the viewport.
      */}
      <div className="pt-2 border-gray-300">



      <div className="space-y-2 py-2">
      {/* Analyzed Code Item */}
      <AnalyzedCodeItem
        fileName="chunk.py:Span"
        status={chipStatus}
        autoFetchChunks
        onClick={() => {
          // Toggle state to simulate an in-progress -> done cycle
          if (chipStatus === 'idle') setChipStatus('in-progress');
          else if (chipStatus === 'in-progress') setChipStatus('done');
          else setChipStatus('idle');
        }}
      />

      {/* Searched Codebase */}
      <SearchedCodebase
        status={searchStatus}
        onClick={() => {
          if (searchStatus === 'idle') {
            setSearchStatus('in-progress'); // Start searching

            // Simulate search completion after 3 seconds
            setTimeout(() => {
              setSearchStatus('done');
            }, 3000);
          }
        }}
      />
    </div>


        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={1}
            className="bg-neutral-700 scrollbar-thumb-gray-500 p-2 pr-12 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 w-full min-h-[70px] max-h-[300px] overflow-y-auto text-white resize-none"
            placeholder="Ask anything (⌘L), @ to mention code blocks"
            value={userInput}
            onChange={(e) => {
              setUserInput(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent new line
                handleSend();
              }
            }}
            disabled={isLoading}
          />
          <div className="top-1/2 right-3 absolute flex items-center -translate-y-1/2">
            {isLoading ? (
              <button
                className="flex justify-center items-center bg-red-500 rounded-sm w-4 h-4"
                onClick={cancelChat}
              />
            ) : (
              <button className="flex justify-center items-center" onClick={handleSend}>
                <EnterIcon className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
        {/* Toggle Switch for Chat / Write modes */}
        <div className="flex justify-end items-center text-xs">
          <span className="font-medium text-white">Chat</span>
          <label className="inline-flex relative items-center mx-2 cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={mode === 'write'}
              onChange={() => {
                if (!isLoading) {
                  setMode(mode === 'chat' ? 'write' : 'chat');
                }
              }}
              disabled={isLoading}
            />
            <div className="peer peer-checked:bg-blue-500 after:top-0.5 after:left-0.5 after:absolute bg-gray-200 after:bg-white dark:bg-gray-700 after:border after:border-gray-300 rounded-full after:rounded-full peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-300 w-8 after:w-3 h-4 after:h-3 after:content-[''] after:transition-all peer-checked:after:translate-x-4" />
          </label>
          <span className="font-medium text-white">Write</span>
        </div>
      </div>
    </div>
  );
}
