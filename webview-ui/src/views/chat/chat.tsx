// file: webview-ui/src/components/Chat.tsx
import React, { useRef, useState, useEffect } from 'react';
import { useChatStore, useChatSettingStore, Session } from '../../stores/chatStore';
import { CodeActionPanel } from './codeActionPanel';
import { CircleUserRound } from 'lucide-react';
import { EnterIcon } from '../../components/ui/enterIcon';
import Markdown from 'react-markdown';
import { AnalyzedCodeItem, SearchedCodebase } from './AnalysisChips';
import { ParserUI } from './parser';
import { BotMessageSquare } from 'lucide-react';
import { getSessionChats, getSessions } from '@/commandApi';

export function ChatUI() {
  // Get chat messages and functions from the chat store.
  const { history: messages, current, isLoading, sendChatMessage, cancelChat, showSessionsBox, showAllSessions, selectedSession, sessions, sessionChats } = useChatStore();
  // Get the current chat type and its setter from the chat setting store.
  const { chatType, setChatType } = useChatSettingStore();
  const [visibleSessions, setVisibleSessions] = useState(3); // initial sessions
  const [userInput, setUserInput] = useState('');
  const [chipStatus, setChipStatus] = useState<'idle' | 'in-progress' | 'done' | 'error'>('idle');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'in-progress' | 'done'>('idle');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerEndRef = useRef<HTMLDivElement | null>(null);
  const queryTopEndRef = useRef<HTMLDivElement | null>(null);

  // Function to handle showing all sessions
  const handleShowMore = () => {
    useChatStore.setState({ showAllSessions: true })
  };

  // Auto-resize the textarea (min 70px, max 300px)
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    queryTopEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    useChatStore.setState({ showSessionsBox: false })
    if (!userInput.trim()) return;
    const userQuery = userInput.trim();
    setUserInput('');
    await sendChatMessage(userQuery);
    if (textareaRef.current) {
      textareaRef.current.style.height = '70px';
    }
  };

  useEffect(() => {
    getSessions()
  }, [])


  useEffect(() => {
    getSessionChats()
  }, [])

  // Scroll to bottom when new messages arrive.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, current?.text]); // 🟢 Also scroll on current message update

  useEffect(() => {
    console.log("SelectedSession", selectedSession)
  }, [selectedSession])

  useEffect(() => {
    // Scroll to the bottom when a new session is selected
    if (chatContainerEndRef.current) {
      chatContainerEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [selectedSession]);

  return (
    <div className='flex flex-col justify-between h-full relative'>
      <div className="flex-grow overflow-y-auto">
        {/* Past Sessions */}
        {showSessionsBox && selectedSession === 0 && (
          <div>
            <div className='mb-24 mt-10'>
              <BotMessageSquare className='px-4 h-20 w-20 text-white' />
              <h1 className="text-3xl font-bold text-white px-4">Chat with DeputyDev</h1>
            </div>
            <h3 className="text-lg font-bold text-white px-4">Past Conversations</h3>
            <div className="session-box p-4 h-36 overflow-y-auto">
              {showAllSessions ? sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => useChatStore.setState({ selectedSession: session.id })}
                  className="bg-neutral-700 border rounded-lg p-1 session-title text-white mb-3 flex justify-between w-full transition-transform transform hover:scale-105 hover:bg-neutral-600"
                >
                  <div className='text-sm overflow-hidden whitespace-nowrap text-ellipsis'>{session.summary}</div>
                  <span className="text-sm text-gray-400">{session.age}</span>
                </button>
              )) : sessions.slice(0, visibleSessions).map(session => (
                <div className="session-box">
                  <button
                    key={session.id}
                    onClick={() => useChatStore.setState({ selectedSession: session.id })}
                    className="bg-neutral-700 border rounded-lg p-1 session-title text-white mb-3 flex justify-between w-full transition-transform transform hover:scale-105 hover:bg-neutral-600"
                  >
                    <div className='text-sm overflow-hidden whitespace-nowrap text-ellipsis'>{session.summary}</div>
                    <span className="text-sm text-gray-400">{session.age}</span>
                  </button>
                </div>
              ))}
            </div>
            {!showAllSessions && visibleSessions < sessions.length && (
              <button onClick={handleShowMore} className="text-white mt-2 px-4">
                Show More...
              </button>
            )}
          </div>
        )}

        {selectedSession !== 0 && (
          <ParserUI sessionChats={sessionChats} />
        )}
        {/* Invisible div just to instant scroll to bottom for session chats */}
        <div ref={chatContainerEndRef} />
        {/* Message display area */}
        <div className="flex-grow space-y-4 py-2 overflow-auto">
          <div ref={queryTopEndRef} />
          {messages.map((m, idx) => {
            if (m.type === 'user') {
              return (
                <div key={idx} className="flex items-center gap-2">
                  <CircleUserRound className="text-neutral-400" size={18} />
                  <span className="text-white">{m.text}</span>
                </div>
              );
            } else {
              // For assistant messages, replace inline code snippet markers with CodeActionPanel components.
              const regex = /\[\[CODE_SNIPPET_([a-zA-Z0-9-_]+)\]\]/g;
              const parts: (string | { snippetId: string })[] = [];
              let lastIndex = 0;
              let match;
              while ((match = regex.exec(m.text)) !== null) {
                if (match.index > lastIndex) {
                  parts.push(m.text.substring(lastIndex, match.index));
                }
                parts.push({ snippetId: match[1] });
                lastIndex = match.index + match[0].length;
              }
              if (lastIndex < m.text.length) {
                parts.push(m.text.substring(lastIndex));
              }
              console.log("parts", parts)
              return (
                <div key={idx} className="text-white">
                  {parts.map((part, index) =>
                    typeof part === 'string' ? (
                      // Render non-code parts with Markdown.
                      // <Markdown key={index} components={{ p: 'span' }}>
                      //   {part}
                      // </Markdown>
                      <span key={index}>{part}</span>
                    ) : (
                      <CodeActionPanel key={index} snippetId={part.snippetId} inline={true} />
                    )
                  )}
                </div>
              );
            }
          })}

          {/* 🟢 Streaming assistant message (real-time updates) */}
          {current && current.text && (
            <div key="streaming" className="text-white animate-pulse text">
              {current.text}
            </div>
          )}

          {/* Invisible marker to scroll into view */}
          <div ref={messagesEndRef} />
        </div>
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
          {/* <AnalyzedCodeItem
            fileName="chunk.py:Span"
            status={chipStatus}
            autoFetchChunks
            onClick={() => {
              if (chipStatus === 'idle') setChipStatus('in-progress');
              else if (chipStatus === 'in-progress') setChipStatus('done');
              else setChipStatus('idle');
            }}
          /> */}

          {/* Searched Codebase */}
          {/* <SearchedCodebase
            status={searchStatus}
            onClick={() => {
              if (searchStatus === 'idle') {
                setSearchStatus('in-progress'); // Start searching
                setTimeout(() => {
                  setSearchStatus('done');
                }, 3000);
              }
            }}
          /> */}
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
        <div className="flex justify-end items-center text-xs mt-2">
          <span className="font-medium text-white">Chat</span>
          <label className="inline-flex relative items-center mx-2 cursor-pointer">
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
            <div className="peer peer-checked:bg-blue-500 after:top-0.5 after:left-0.5 after:absolute bg-gray-200 dark:bg-gray-700 after:border after:border-gray-300 rounded-full after:rounded-full peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-300 w-8 after:w-3 h-4 after:h-3 after:content-[''] after:transition-all peer-checked:after:translate-x-4" />
          </label>
          <span className="font-medium text-white">Write</span>
        </div>
      </div>
    </div>
  );
}
