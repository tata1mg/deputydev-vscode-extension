// file: webview-ui/src/components/Chat.tsx
import { useEffect, useRef, useState } from "react";
import { EnterIcon } from "../../components/enterIcon";
import {
  useChatSettingStore,
  useChatStore,
  initialAutocompleteOptions,
} from "../../stores/chatStore";
import { Trash2 } from "lucide-react";
// import Markdown from 'react-markdown';
import { Tooltip } from "react-tooltip";
// import "react-tooltip/dist/react-tooltip.css"; // Import CSS for styling
import { ChatArea } from "./chatMessagesArea";
import RepoSelector from "./chatElements/RepoSelector";
// import { useRepoSelectorStore } from '../../stores/repoSelectorStore';
import {
  deleteSession,
  getSessionChats,
  getSessions,
  logToOutput,
} from "@/commandApi";

import { BotMessageSquare } from "lucide-react";
import Markdown from "react-markdown";
import { useRepoSelectorStore } from "@/stores/repoSelectorStore";
import "../../styles/markdown-body.css";
import { AutocompleteOption, ChatReferenceItem } from "@/types";
import ReferenceChip from "./referencechip";
import { AutocompleteMenu } from "./autocomplete";
import { isEqual as lodashIsEqual } from "lodash";
import { ChatUserMessage } from "@/types";
import ProgressBar from "./chatElements/progressBar";

export function ChatUI() {
  // Extract state and actions from the chat store.
  const {
    history: messages,
    current,
    isLoading,
    sendChatMessage,
    cancelChat,
    showSessionsBox,
    showAllSessions,
    sessions,
    ChatAutocompleteOptions,
  } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const visibleSessions = 3;
  const repoSelectorEmbedding = useRepoSelectorStore(
    (state) => state.repoSelectorDisabled,
  );
  // const repoSelectorEmbedding = false;
  // const [repoSelectorDisabled] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sessionsPerPage = 20;
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentSessionsPage, setCurrentSessionsPage] = useState(1);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  // Function to handle showing all sessions
  const handleShowMore = () => {
    useChatStore.setState({ showAllSessions: true });
  };

  // Auto-resize the textarea.
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    if (!userInput.trim() || isLoading || repoSelectorEmbedding) return;

    useChatStore.setState({ showSessionsBox: false });

    const message = userInput.trim();
    const editorReferences = [
      ...useChatStore.getState().currentEditorReference,
    ];
    setUserInput("");
    useChatStore.setState({ currentEditorReference: [] });

    const resetTextareaHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "70px";
      }
    };

    try {
      await sendChatMessage(message, editorReferences, () => {});
    } finally {
      resetTextareaHeight();
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    useChatStore.setState({
      sessions: useChatStore
        .getState()
        .sessions.filter((session) => session.id !== sessionId),
    });
    await deleteSession(sessionId);
    console.log(`Delete session ${sessionId}`);
  };

  const fetchSessions = async (pageNumber: number) => {
    setSessionsLoading(true);
    const limit = sessionsPerPage;
    const offset = (pageNumber - 1) * sessionsPerPage;
    getSessions(limit, offset);
    setSessionsLoading(false);
  };
  useEffect(() => {
    fetchSessions(currentSessionsPage);
  }, [currentSessionsPage]);

  // Scroll handler for past sessions
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 5 && !sessionsLoading) {
      setCurrentSessionsPage((prev) => prev + 1);
      fetchSessions(currentSessionsPage + 1);
    }
  };

  useEffect(() => {
    if (
      messages.length > 0 &&
      messages[messages.length - 1].type === "TEXT_BLOCK"
    ) {
      const lastMessage = messages[messages.length - 1] as ChatUserMessage;
      if (lastMessage.actor === "USER") {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }
  }, [messages]);

  const handleGetSessionChats = async (sessionId: number) => {
    getSessionChats(sessionId);
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.endsWith("@")) {
      setShowAutocomplete(true);
      useChatStore.setState({
        ChatAutocompleteOptions: initialAutocompleteOptions,
      });
      setUserInput(e.target.value.substring(0, e.target.value.length - 1));
      const editorRefs = useChatStore.getState().currentEditorReference;
      const newChatRefrenceItem: ChatReferenceItem = {
        index: editorRefs.length,
        type: "keyword",
        keyword: "",
        path: "",
        chunks: [],
      };
      useChatStore.setState({
        currentEditorReference: [...editorRefs, newChatRefrenceItem],
      });
    } else {
      setShowAutocomplete(false);
      setUserInput(e.target.value);
    }
    autoResize();
  };

  const handleChipDelete = (index: number) => {
    const editorRefs = useChatStore.getState().currentEditorReference;
    const newEditorRefs = editorRefs.filter((ref) => ref.index !== index);
    useChatStore.setState({ currentEditorReference: newEditorRefs });
    setShowAutocomplete(false);
  };

  const handleAutoCompleteSelect = (option: AutocompleteOption) => {
    const selectedChipIndex = useChatStore.getState().chipIndexBeingEdited;
    const currentAutocompleteOptions =
      useChatStore.getState().ChatAutocompleteOptions;
    if (lodashIsEqual(currentAutocompleteOptions, initialAutocompleteOptions)) {
      const allChips = [...useChatStore.getState().currentEditorReference];
      allChips[selectedChipIndex].keyword = option.value;
      useChatStore.setState({ currentEditorReference: allChips });
    } else {
      const allChips = [...useChatStore.getState().currentEditorReference];
      allChips[selectedChipIndex].keyword = option.icon + ": " + option.value;
      allChips[selectedChipIndex].chunks = option.chunks;
      allChips[selectedChipIndex].path = option.description;
      allChips[selectedChipIndex].type = option.icon;
      useChatStore.setState({ currentEditorReference: allChips });
      setShowAutocomplete(false);
    }
  };
  // Updated auto-scroll logic with debounce to prevent conflicting manual scrolls
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const threshold = 50;
    let reenableTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < threshold) {
        // User is near the bottom: debounce re-enabling auto-scroll
        if (reenableTimer) clearTimeout(reenableTimer);
        reenableTimer = setTimeout(() => {
          setIsAutoScrollEnabled(true);
        }, 300);
      } else {
        // User scrolled up: cancel any pending re-enable and disable auto-scroll
        if (reenableTimer) {
          clearTimeout(reenableTimer);
          reenableTimer = null;
        }
        setIsAutoScrollEnabled(false);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (reenableTimer) clearTimeout(reenableTimer);
    };
  }, []);

  // Scroll to bottom when new messages arrive (if auto-scroll is enabled)
  useEffect(() => {
    console.log("messages updated:", messages);
    if (isAutoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, current?.content?.text, isAutoScrollEnabled]);

  return (
    <div className="relative flex h-full flex-col justify-between">
      <div className="flex-grow">
        {/* Past Sessions */}
        {showSessionsBox && messages.length === 0 && (
          <div>
            <div className="mb-12 mt-8">
              <BotMessageSquare className="h-20 w-20 px-4" />
              <h1 className="animate-gradient bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text px-4 text-3xl font-bold text-transparent">
                Develop with DeputyDev
              </h1>
            </div>
            {sessions.length > 0 && (
              <div>
                <h3 className="px-4 text-lg font-bold">Past Conversations</h3>
                <div
                  className="session-box h-[128px] overflow-y-auto px-4"
                  onScroll={handleScroll}
                >
                  {!showAllSessions ? (
                    <div>
                      {sessions.slice(0, visibleSessions).map((session) => (
                        <div className="flex gap-2" key={session.id}>
                          <div
                            onClick={() => handleGetSessionChats(session.id)}
                            className="session-title relative mb-3 flex w-[85%] transform justify-between gap-1 rounded border border-gray-500/10 bg-gray-500/20 p-1 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100"
                          >
                            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                              {session.summary}
                            </div>
                            <span>{session.age}</span>
                          </div>
                          <Trash2
                            className="m-1 transform opacity-50 transition-transform hover:cursor-pointer hover:opacity-70"
                            onClick={(e) => {
                              handleDeleteSession(session.id);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {sessions
                        .slice(0, currentSessionsPage * sessionsPerPage)
                        .map((session) => (
                          <div className="flex gap-2" key={session.id}>
                            <div
                              onClick={() => handleGetSessionChats(session.id)}
                              className="session-title relative mb-3 flex w-[85%] transform justify-between gap-1 rounded border-[1px] border-gray-500/10 bg-gray-500/20 p-1 text-sm opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100"
                            >
                              <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                {session.summary}
                              </div>
                              <span>{session.age}</span>
                            </div>
                            <div className="flex-shrink-0">
                              <Trash2
                                className="m-1 transform opacity-50 transition-transform hover:cursor-pointer hover:opacity-70"
                                onClick={(e) => {
                                  handleDeleteSession(session.id);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  {sessionsLoading && <div>Loading...</div>}
                </div>
                {!sessionsLoading &&
                  !showAllSessions &&
                  sessions.length > visibleSessions && (
                    <button onClick={() => handleShowMore()} className="px-4">
                      Show More...
                    </button>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-[150px] h-full overflow-auto px-4">
        <ChatArea />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Layer */}
      <div className="absolute bottom-0 left-0 right-0 mx-2 mt-4">
        <div className="">
          {showAutocomplete && (
            <div className="w-full">
              <AutocompleteMenu
                options={ChatAutocompleteOptions}
                onSelect={handleAutoCompleteSelect}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {useChatStore.getState().currentEditorReference?.map((chip) => (
              <ReferenceChip
                chipIndex={chip.index}
                initialText={chip.keyword}
                onDelete={() => {
                  handleChipDelete(chip.index);
                }}
                autoEdit={
                  chip.index ===
                  useChatStore.getState().currentEditorReference.length - 1
                }
                setShowAutoComplete={setShowAutocomplete}
              />
            ))}
          </div>

          {repoSelectorEmbedding && (
            <div className="mb-[2px] w-full">
              <ProgressBar progress={useChatStore.getState().progressBar} />
            </div>
          )}
          {/* The textarea remains enabled even when a response is pending */}
          <div className="relative w-full">
            <textarea
              ref={textareaRef}
              rows={1}
              className={`scrollbar-thumb-gray-500 relative max-h-[300px] min-h-[70px] w-full resize-none overflow-y-auto rounded border border-[--vscode-commandCenter-inactiveBorder] bg-[--deputydev-input-background] p-2 pr-12 focus:border-blue-600/70 focus:outline-none focus:ring-0 active:border-blue-600/70 disabled:cursor-not-allowed disabled:opacity-50`}
              placeholder="Ask anything (⌘L), @ to mention code blocks"
              value={userInput}
              onChange={handleTextAreaChange}
              onKeyDown={(e) => {
                if (
                  !repoSelectorEmbedding &&
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  if (!isLoading) {
                    handleSend();
                  }
                }
              }}
              disabled={repoSelectorEmbedding}
              {...(repoSelectorEmbedding && {
                "data-tooltip-id": "repo-tooltip",
                "data-tooltip-content":
                  "Please wait, DeputyDev is initializing.",
              })}
            />

            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {isLoading ? (
                <button
                  className="flex h-4 w-4 items-center justify-center rounded-sm bg-red-500"
                  onClick={cancelChat}
                />
              ) : (
                <button
                  className="flex items-center justify-center"
                  onClick={() => {
                    if (!isLoading) {
                      handleSend();
                    }
                  }}
                >
                  <EnterIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            <Tooltip id="repo-tooltip" />
          </div>
        </div>

        {/* Chat Type Toggle and RepoSelector */}
        <div className=" flex items-center justify-between text-xs">
          <div>
            <RepoSelector />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium">Chat</span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={chatType === "write"}
                onChange={() => {
                  if (!isLoading) {
                    setChatType(chatType === "ask" ? "write" : "ask");
                  }
                }}
                disabled={isLoading}
              />
              <div className="peer h-4 w-8 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-500 peer-checked:after:translate-x-4" />
            </label>
            <span className="font-medium">Write</span>
          </div>
        </div>
      </div>
    </div>
  );
}
