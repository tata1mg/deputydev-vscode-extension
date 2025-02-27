// file: webview-ui/src/components/Chat.tsx
import { useEffect, useRef, useState } from 'react';
import { EnterIcon } from '../../components/enterIcon';
import { useChatSettingStore, useChatStore } from '../../stores/chatStore';
// import Markdown from 'react-markdown';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css'; // Import CSS for styling
import { ChatArea } from './chatMessagesArea';
import RepoSelector from './chatElements/RepoSelector';
// import { useRepoSelectorStore } from '../../stores/repoSelectorStore';


export function ChatUI() {
  // Extract state and actions from the chat store.
  const { history: messages, current, isLoading, sendChatMessage, cancelChat } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();

  // const repoSelectorDisabled = useRepoSelectorStore((state) => state.repoSelectorDisabled);
  const [repoSelectorDisabled] = useState(false);
  const [userInput, setUserInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-resize the textarea.
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    if (!userInput.trim()) return;
    let message = userInput.trim();
    setUserInput('');
    await sendChatMessage(message, (data) => {
    });
    if (textareaRef.current) {
      textareaRef.current.style.height = '70px';
    }
  };

  // Auto-scroll to bottom when messages update.
  useEffect(() => {
    console.log('messages updated:', messages);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, current?.content?.text]);

  return (
    <div className="flex flex-col h-full">
      {/* Message Display Area */}
      <div className="flex-grow space-y-4 py-2 overflow-auto">
        <ChatArea />

        {/*  Streaming messages  */}
        {current && current.content?.text && (   
          <div key="streaming" className="text-white">
            {current.content.text}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>


      {/* Input Layer */}
      <div className="pt-2 border-gray-300">
        <div className="space-y-2 py-2"></div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={1}
            className="bg-neutral-700 scrollbar-thumb-gray-500 p-2 pr-12 border border-gray-300 rounded 
                      focus:outline-none focus:ring-1 focus:ring-blue-600 w-full min-h-[70px] max-h-[300px] 
                      overflow-y-auto text-white resize-none disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={repoSelectorDisabled || isLoading}
            {...(repoSelectorDisabled && {
              'data-tooltip-id': 'repo-tooltip',
              'data-tooltip-content': 'Please wait, your repo is embedding.',
            })}
          />

          <div className="top-1/2 right-3 absolute flex items-center -translate-y-1/2">
            {isLoading ? (
              <button
                className="flex justify-center items-center bg-red-500 rounded-sm w-4 h-4 
                          disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={cancelChat}
                disabled={repoSelectorDisabled}
                {...(repoSelectorDisabled && {
                  'data-tooltip-id': 'repo-tooltip',
                  'data-tooltip-content': 'Please wait, your repo is embedding.',
                })}
              />
            ) : (
              <button
                className="flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSend}
                disabled={repoSelectorDisabled}
                {...(repoSelectorDisabled && {
                  'data-tooltip-id': 'repo-tooltip',
                  'data-tooltip-content': 'Please wait, your repo is embedding.',
                })}
              >
                <EnterIcon className="w-5 h-5 text-white" />
              </button>
            )}
          </div>

          {/* Tooltip Component */}
          <Tooltip id="repo-tooltip" />
        </div>

        {/* Chat Type Toggle */}
        <div className="flex items-center justify-between text-xs">
          {/* Left side: RepoSelector */}
          <div className="flex items-center gap-2">
            <RepoSelector />
          </div>

          {/* Right side: Chat/Write toggle */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">Chat</span>
            <label className="inline-flex relative items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={chatType === 'write'}
                onChange={() => {
                  if (!isLoading) {
                    setChatType(chatType === 'ask' ? 'write' : 'ask');
                  }
                }}
                disabled={isLoading}
              />
              <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-blue-500 
                              after:content-[''] after:absolute after:top-0.5 after:left-0.5 
                              after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-all 
                              peer-checked:after:translate-x-4"
              />
            </label>
            <span className="font-medium text-white">Write</span>
          </div>
        </div>
      </div>

    </div>
  );
}
