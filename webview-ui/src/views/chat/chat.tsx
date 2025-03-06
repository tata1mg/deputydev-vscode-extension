// file: webview-ui/src/components/Chat.tsx
import { useEffect, useRef, useState } from 'react';
import { EnterIcon } from '../../components/enterIcon';
import { useChatSettingStore, useChatStore, Session } from '../../stores/chatStore';
// import Markdown from 'react-markdown';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css'; // Import CSS for styling
import { ChatArea } from './chatMessagesArea';
import RepoSelector from './chatElements/RepoSelector';
// import { useRepoSelectorStore } from '../../stores/repoSelectorStore';
import { getSessionChats, getSessions } from '@/commandApi';
import { BotMessageSquare } from 'lucide-react';
import Markdown from 'react-markdown';
import { useRepoSelectorStore } from '@/stores/repoSelectorStore';

export function ChatUI() {
  // Extract state and actions from the chat store.
  const { history: messages, current, isLoading, sendChatMessage, cancelChat, showSessionsBox, showAllSessions, selectedSession, sessions, sessionChats } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const visibleSessions = 3;
  const repoSelectorDisabled = useRepoSelectorStore((state) => state.repoSelectorDisabled);
  // const [repoSelectorDisabled] = useState(false);
  const [userInput, setUserInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerEndRef = useRef<HTMLDivElement | null>(null);


  // Function to handle showing all sessions
  const handleShowMore = () => {
    useChatStore.setState({ showAllSessions: true })
  };

  // Auto-resize the textarea.
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    useChatStore.setState({ showSessionsBox: false });
    if (!userInput.trim()) return;
    
    let message = userInput.trim();
    setUserInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '70px';
    }
  
    await sendChatMessage(message, (data) => {});
  };
  

  useEffect(() => {
    getSessions()
  }, [])


  useEffect(() => {
    getSessionChats()
  }, [])

  // Scroll to bottom when new messages arrive.
  useEffect(() => {
    console.log('messages updated:', messages);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, current?.content?.text]);

  useEffect(() => {
    console.log("SelectedSession", selectedSession)
  }, [selectedSession])

  useEffect(() => {
    // Scroll to the bottom when a new session is selected
    if (chatContainerEndRef.current) {
      chatContainerEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
            {sessions.length > 0 && (
              <h3 className="text-lg font-bold text-white px-4">Past Conversations</h3>
            )}
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

        {/* {selectedSession !== 0 && (
          <ParserUI sessionChats={sessionChats} />
        )} */}



        {/* Invisible div just to instant scroll to bottom for session chats */}
        <div ref={chatContainerEndRef} />

        <div className="flex-grow space-y-4 py-2 overflow-auto">

          <ChatArea />

          {current && typeof current.content?.text === "string" && (
            <div key="streaming" className="text-white">
              <Markdown>{current.content.text}</Markdown>
            </div>
          )}


        </div>
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
