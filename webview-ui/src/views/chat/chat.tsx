// file: webview-ui/src/components/Chat.tsx
import { useEffect, useRef, useState } from 'react';
import { EnterIcon } from '../../components/enterIcon';
import { useChatSettingStore, useChatStore } from '../../stores/chatStore';
import { Trash2 } from 'lucide-react';
// import Markdown from 'react-markdown';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css'; // Import CSS for styling
import { ParserUI } from './parser';
import { ChatArea } from './chatMessagesArea';
import RepoSelector from './chatElements/RepoSelector';
// import { useRepoSelectorStore } from '../../stores/repoSelectorStore';
import { deleteSession, getSessionChats, getSessions } from '@/commandApi';
import { BotMessageSquare } from 'lucide-react';
import Markdown from 'react-markdown';
import { useRepoSelectorStore } from '@/stores/repoSelectorStore';
import '../../styles/markdown-body.css';


export function ChatUI() {
  // Extract state and actions from the chat store.
  const { history: messages, current, isLoading, sendChatMessage, cancelChat, showSessionsBox, showAllSessions, sessions, sessionChats } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const visibleSessions = 3;
  const repoSelectorEmbedding = useRepoSelectorStore((state) => state.repoSelectorDisabled);
  // const [repoSelectorDisabled] = useState(false);
  const [userInput, setUserInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerEndRef = useRef<HTMLDivElement | null>(null);
  const sessionsPerPage = 20;
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentSessionsPage, setCurrentSessionsPage] = useState(1);


  // Function to handle showing all sessions
  const handleShowMore = () => {
    useChatStore.setState({ showAllSessions: true })
  };


  // Do not block user typing or canceling even if a response is pending.
  // Instead, we simply block sending a new message.
  const blockSendMessage = isLoading;

  // The repo selector should be disabled if the repo is embedding, a response is pending, or there is chat history.
  const disableRepoSelector = isLoading || messages.length > 0;
  const repoTooltipProps: Partial<Record<string, string>> = disableRepoSelector
    ? { 'data-tooltip-id': 'repo-tooltip', 'data-tooltip-content': 'Create new chat to select new repo.' }
    : {};

  // Auto-resize the textarea.
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    useChatStore.setState({ showSessionsBox: false });
    if (!userInput.trim() || blockSendMessage) return;

    let message = userInput.trim();
    setUserInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '70px';
    }

    await sendChatMessage(message, (data) => { });
  };


  const handleDeleteSession = async (sessionId: number) => {
    useChatStore.setState({
      sessions: useChatStore.getState().sessions.filter((session) => session.id !== sessionId)
    })
    await deleteSession(sessionId)
    console.log(`Delete session ${sessionId}`);
  }

  const fetchSessions = async (pageNumber: number) => {
    setSessionsLoading(true);
    const limit = sessionsPerPage;
    const offset = (pageNumber - 1) * sessionsPerPage;
    getSessions(limit, offset)
    setSessionsLoading(false);
  }
  useEffect(() => {
    fetchSessions(currentSessionsPage);
  }, [currentSessionsPage]);

  // Scroll handler for past sessions
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 5 && !sessionsLoading) {
      setCurrentSessionsPage(prev => prev + 1);
      fetchSessions(currentSessionsPage + 1);
    }
  };

  const handleGetSessionChats = async (sessionId: number) => {
    getSessionChats(sessionId)
  }

  // Scroll to bottom when new messages arrive.
  useEffect(() => {
    console.log('messages updated:', messages);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, current?.content?.text]);

  useEffect(() => {
    // Scroll to the bottom when a new session is selected
    if (chatContainerEndRef.current) {
      chatContainerEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionChats]);

  return (
    <div className='flex flex-col justify-between h-full relative'>
      <div className="flex-grow overflow-y-auto">
        {/* Past Sessions */}
        {showSessionsBox && sessionChats.length === 0 && (
          <div>
            <div className='mb-14 mt-10'>
              <BotMessageSquare className='px-4 h-20 w-20 text-white' />
              <h1 className="text-3xl font-bold text-white px-4">Chat with DeputyDev</h1>
            </div>
            {sessions.length > 0 && (
              <h3 className="text-lg font-bold text-white px-4">Past Conversations</h3>
            )}
            <div className="session-box p-4 h-[170px] overflow-y-auto" onScroll={handleScroll}>
              {!showAllSessions ? (
                <div>
                  {sessions.slice(0, visibleSessions).map(session => (
                    <div className='flex gap-2' key={session.id}>
                      <div
                        onClick={() => handleGetSessionChats(session.id)}
                        className="bg-neutral-700 border rounded-lg p-1 session-title text-white mb-3 flex justify-between transition-transform transform hover:scale-105 hover:bg-neutral-600 hover:cursor-pointer w-[80%] relative"
                      >
                        <div className='text-sm overflow-hidden whitespace-nowrap text-ellipsis'>{session.summary}</div>
                        <span className="text-sm text-gray-400">{session.age}</span>
                      </div>
                      <div>
                        <Trash2
                          className='text-gray-400 hover:text-white hover:cursor-pointer m-1'
                          onClick={(e) => {
                            handleDeleteSession(session.id);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {sessions.slice(0, currentSessionsPage * sessionsPerPage).map(session => (
                    <div className='flex gap-2' key={session.id}>
                      <div
                        onClick={() => handleGetSessionChats(session.id)}
                        className="bg-neutral-700 border rounded-lg p-1 session-title text-white mb-3 flex justify-between transition-transform transform hover:scale-105 hover:bg-neutral-600 hover:cursor-pointer w-[80%] relative"
                      >
                        <div className='text-sm overflow-hidden whitespace-nowrap text-ellipsis'>{session.summary}</div>
                        <span className="text-sm text-gray-400">{session.age}</span>
                      </div>
                      <div>
                        <Trash2
                          className='text-gray-400 hover:text-white hover:cursor-pointer m-1'
                          onClick={(e) => {
                            handleDeleteSession(session.id);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sessionsLoading && <div className='text-white'>Loading...</div>}
            </div>
            {!sessionsLoading && !showAllSessions && (
              <button onClick={() => handleShowMore()} className="text-white px-4">
                Show More...
              </button>
            )}
          </div>
        )}

        {sessionChats.length > 0 && (
          <ParserUI sessionChats={sessionChats} />
        )}



        {/* Invisible div just to instant scroll to bottom for session chats */}
        <div ref={chatContainerEndRef} />

        <div className="flex-grow space-y-4 py-2 overflow-auto">

          <ChatArea />

        </div>
        <div ref={messagesEndRef} />
      </div>


      {/* Input Layer */}
      <div className="">
        <div className="space-y-2"></div>
        <div className="relative">
          {/* The textarea remains enabled even when a response is pending */}
          <textarea
            ref={textareaRef}
            rows={1}
            className={`bg-neutral-700 scrollbar-thumb-gray-500 p-2 pr-12 border border-gray-300 rounded
              focus:outline-none focus:ring-1 focus:ring-blue-600 w-full min-h-[70px] max-h-[300px]
              overflow-y-auto text-white resize-none ${repoSelectorEmbedding ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''}`}
            placeholder="Ask anything (⌘L), @ to mention code blocks"
            value={userInput}
            onChange={(e) => {
              if (!repoSelectorEmbedding) {
                setUserInput(e.target.value);
                autoResize();
              }
            }}
            onKeyDown={(e) => {
              if (!repoSelectorEmbedding && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading) {
                  handleSend();
                }
              }
            }}

            disabled={repoSelectorEmbedding}
            {...(repoSelectorEmbedding && {
              'data-tooltip-id': 'repo-tooltip',
              'data-tooltip-content': 'Please wait, your repo is embedding.'
            })}
          />





          {/* The cancel button remains enabled even if a response is pending */}
          <div className="top-1/2 right-3 absolute flex items-center -translate-y-1/2">
            {isLoading ? (
              <button
                className="flex justify-center items-center bg-red-500 rounded-sm w-4 h-4"
                onClick={cancelChat}
              />
            ) : (
              <button
                className="flex justify-center items-center"
                onClick={() => {
                  if (!blockSendMessage) {
                    handleSend();
                  }
                }}
              >
                <EnterIcon className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
          <Tooltip id="repo-tooltip" />
        </div>

        {/* Chat Type Toggle and RepoSelector */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <RepoSelector disabled={disableRepoSelector} tooltipProps={repoTooltipProps} />
          </div>

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
