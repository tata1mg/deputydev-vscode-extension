import { useEffect, useRef, useState } from "react";
import { EnterIcon } from "../../components/enterIcon";
import { ChatArea } from "./chatMessagesArea";
import { AutocompleteMenu } from "./autocomplete";
import { Folder, File, Code } from "lucide-react";
import { AutocompleteOption } from "@/types";
import { keywordSearch, keywordTypeSearch } from "@/commandApi";
import { useChatSettingStore, useChatStore, Session } from '../../stores/chatStore';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import RepoSelector from './chatElements/RepoSelector';
import { getSessionChats, getSessions } from '@/commandApi';
import { BotMessageSquare } from 'lucide-react';
import Markdown from 'react-markdown';
import { useRepoSelectorStore } from '@/stores/repoSelectorStore';
import '../../styles/markdown-body.css';

const initialAutocompleteOptions: AutocompleteOption[] = [
  {
    icon: 'directory',
    label: "Directory",
    value: "Directory: ",
    description: "A folder containing files and subfolders",
  },
  {
    icon: "file",
    label: "File",
    value: "File: ",
    description: "A single file such as a document or script",
  },
  {
    icon: "function",
    label: "Function",
    value: "Function: ",
    description: "A short piece of reusable code",
  },
  {
    icon: "class",
    label: "Class",
    value: "Class: ",
    description: "A short piece of reusable class code",
  },
];

export function ChatUI() {
  const [repoSelectorDisabled] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [chipText, setChipText] = useState<string | null>(null);
  const { history: messages, current, isLoading, sendChatMessage, cancelChat, showSessionsBox, showAllSessions, selectedSession, sessions, sessionChats } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const visibleSessions = 3;
  const repoSelectorEmbedding = useRepoSelectorStore((state) => state.repoSelectorDisabled);
  const [userInput, setUserInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chipInputRef = useRef<HTMLInputElement | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<number | null>(null);
  const [selectedReferenceItem, setSelectedReferenceItem] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chipText !== null && chipInputRef.current) {
      chipInputRef.current.focus();
    }
  }, [chipText]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleShowMore = () => {
    useChatStore.setState({ showAllSessions: true });
  };

  const handleSend = async () => {
    useChatStore.setState({ showSessionsBox: false });
    if (!userInput.trim()) return;

    const message = userInput.trim();
    setUserInput('');

    if (textareaRef.current) {
      textareaRef.current.style.height = '70px';
    }

    await sendChatMessage(message, (data) => { });
  };

  const handleSelectAutocomplete = (label: string) => {
    setChipText(label);
    setSelectedReferenceItem(label);
    setShowAutocomplete(false);
  };

  const handleChipClose = () => {
    setChipText(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    setShowAutocomplete(false);
  };

  function startsWithPrefix(word: string) {
    const prefixes = ["File: ", "Directory: ", "Class: ", "Function: "];
    return prefixes.some(prefix => word.startsWith(prefix));
  }

  const handleChipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setShowAutocomplete(true);
    setChipText(newValue);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const newTimeout = window.setTimeout(async () => {
      if (startsWithPrefix(newValue)) {
        await keywordTypeSearch({
          keyword: newValue.split(": ")[1],
          type: newValue.split(": ")[0].toLowerCase()
        });
      } else {
        await keywordSearch({ keyword: newValue });
      }
    }, 500);

    setTypingTimeout(newTimeout);
  };

  const blockSendMessage = isLoading;
  const disableRepoSelector = isLoading || messages.length > 0;
  const repoTooltipProps: Partial<Record<string, string>> = disableRepoSelector
    ? { 'data-tooltip-id': 'repo-tooltip', 'data-tooltip-content': 'Create new chat to select new repo.' }
    : {};

  return (
    <div className="flex flex-col justify-between h-full relative">
      <div className="flex-grow overflow-y-auto">
        <ChatArea />

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
                <button
                  key={session.id}
                  onClick={() => useChatStore.setState({ selectedSession: session.id })}
                  className="bg-neutral-700 border rounded-lg p-1 session-title text-white mb-3 flex justify-between w-full transition-transform transform hover:scale-105 hover:bg-neutral-600"
                >
                  <div className='text-sm overflow-hidden whitespace-nowrap text-ellipsis'>{session.summary}</div>
                  <span className="text-sm text-gray-400">{session.age}</span>
                </button>
              ))}
            </div>

            {!showAllSessions && visibleSessions < sessions.length && (
              <button onClick={handleShowMore} className="text-white mt-2 px-4">
                Show More...
              </button>
            )}
          </div>
        )}

        <div ref={chatContainerEndRef} />
        <div ref={messagesEndRef} />
      </div>

      {showAutocomplete && (
        <div className="w-full">
          <AutocompleteMenu
            options={chipText ? useChatStore.getState().ChatAutocompleteOptions : initialAutocompleteOptions}
            onSelect={handleSelectAutocomplete}
          />
        </div>
      )}

      <div className="flex flex-col">
        <div className="relative mt-0 p-2 bg-neutral-700 border border-gray-300 rounded w-full min-h-[70px] max-h-[300px]">
          <div className="flex flex-wrap gap-2">
            {chipText !== null && (
              <div className="flex items-center px-2 py-1 bg-gray-600 text-white rounded-md">
                <input
                  ref={chipInputRef}
                  type="text"
                  value={chipText}
                  className="bg-transparent border-none text-white outline-none"
                  onChange={handleChipChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setShowAutocomplete(false);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }
                  }}
                />
                <button className="ml-2 text-red-400" onClick={handleChipClose}>×</button>
              </div>
            )}
          </div>

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