// file: webview-ui/src/components/Chat.tsx
import { useEffect, useRef, useState } from "react";
import { EnterIcon } from "../../components/enterIcon";
import {
  useChatSettingStore,
  useChatStore,
  initialAutocompleteOptions,
} from "../../stores/chatStore";
import { Trash2, Check, Turtle } from "lucide-react";
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
    showEmbeddingFailed,
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
  const [showDefaultContent, setShowDefaultContent] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);

  useEffect(() => {
    if (showEmbeddingFailed) {
      setShowProgressBar(false); // Close immediately if showEmbeddingFailed is true
    } else if (!repoSelectorEmbedding) {
      setShowProgressBar(true);
      const timer = setTimeout(() => {
        setShowProgressBar(false);
      }, 1500);

      return () => clearTimeout(timer); // Cleanup timeout on unmount
    }
  }, [repoSelectorEmbedding, showEmbeddingFailed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowDefaultContent(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleCopy = () => {
      let copiedText = "";

      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        copiedText = activeElement.value.substring(
          activeElement.selectionStart || 0,
          activeElement.selectionEnd || 0
        );
      } else {
        copiedText = window.getSelection()?.toString() || "";
      }

      logToOutput("info", `Copied: ${JSON.stringify(copiedText)}`);
    };

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, []);

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

    const resetTextareaHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "70px";
      }
    };

    useChatStore.setState({ showSessionsBox: false });

    const message = userInput.trim();
    const editorReferences = [
      ...useChatStore.getState().currentEditorReference,
    ];
    setUserInput("");
    useChatStore.setState({ currentEditorReference: [] });
    resetTextareaHeight();

    try {
      await sendChatMessage(message, editorReferences, () => { });
    } finally {
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    useChatStore.setState({
      sessions: useChatStore
        .getState()
        .sessions.filter((session) => session.id !== sessionId),
    });
    await deleteSession(sessionId);
    // console.log(`Delete session ${sessionId}`);
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
      allChips[selectedChipIndex].value = option.value;
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
    // console.log("messages updated:", messages);
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
            <div>
              <div className="mb-12 mt-8">
                <h1 className="animate-gradient bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text px-4 text-3xl font-bold text-transparent">
                  Develop with DeputyDev
                </h1>
              </div>
              {sessions.length > 0 ? (
                <div>
                  <h3 className="mb-1 px-4 text-lg font-bold">
                    Past Conversations
                  </h3>
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
                              className="session-title relative mb-3 flex w-[85%] transform justify-between gap-1 rounded border border-gray-500/10 bg-gray-500/20 p-1 opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100"
                            >
                              <div className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                                {session.summary}
                              </div>
                              <span className="text-xs mt-1">{session.age}</span>
                            </div>
                            <Trash2
                              className="text-xs m-1 transform opacity-50 transition-transform hover:cursor-pointer hover:opacity-70"
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
                                <div className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                                  {session.summary}
                                </div>
                                <span className="text-xs mt-1">{session.age}</span>
                              </div>
                              <div className="flex-shrink-0">
                                <Trash2
                                  className="text-xs m-1 transform opacity-50 transition-transform hover:cursor-pointer hover:opacity-70"
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
              ) : (
                showDefaultContent && (
                  <div className="px-4 fade-in h-[128px]">
                    <div className="flex items-center gap-2">
                      <p className="mb-2 text-lg text-gray-400">
                        You are ready to go.
                      </p>
                      <Check className="mb-1 animate-pulse text-sm text-green-500" />
                    </div>
                    <p className="text-md">
                      Ask questions about your repository or instantly generate
                      code, tests, and documentation
                    </p>
                  </div>
                )
              )}
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-500 text-left mt-4">DeputyDev is powered by AI. It can make mistakes. Please double check all output.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mb-[150px] h-full overflow-auto px-4">
        <ChatArea />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Layer */}
      <div className="absolute bottom-0 left-0 right-0 mx-2 mt-3.5">
        <div className="">
          {showAutocomplete && (
            <div className="w-full">
              <AutocompleteMenu
                options={ChatAutocompleteOptions}
                onSelect={handleAutoCompleteSelect}
              />
            </div>
          )}
          {/* <div className="flex flex-wrap gap-1">
            {useChatStore.getState().currentEditorReference?.map((chip) => (
              <ReferenceChip
                chipIndex={chip.index}
                initialText={chip.keyword}
                onDelete={() => {
                  handleChipDelete(chip.index);
                }}
                autoEdit={
                  !chip.noEdit &&
                  chip.index ===
                    useChatStore.getState().currentEditorReference.length - 1
                }
                setShowAutoComplete={setShowAutocomplete}
                chunks={chip.chunks}
              />
            ))}
          </div> */}

          {showEmbeddingFailed && (
            <div className="p-4 text-red-500 text-md text-center">
              <p>Indexing Failed !!!</p>
            </div>
          )}

          {showProgressBar && (
            <div className="mb-[2px] w-full">
              <ProgressBar progress={useChatStore.getState().progressBar} />
            </div>
          )}
          {/* The textarea remains enabled even when a response is pending */}
          <div className="relative w-full">
            <div className="flex flex-wrap mb-1 items-center gap-1 rounded border border-[--vscode-commandCenter-inactiveBorder] bg-[--deputydev-input-background] p-2">
              {useChatStore.getState().currentEditorReference?.map((chip) => (
                <ReferenceChip
                  key={chip.index}
                  chipIndex={chip.index}
                  initialText={chip.keyword}
                  onDelete={() => {
                    handleChipDelete(chip.index);
                  }}
                  autoEdit={
                    !chip.noEdit &&
                    chip.index ===
                    useChatStore.getState().currentEditorReference.length - 1
                  }
                  setShowAutoComplete={setShowAutocomplete}
                  chunks={chip.chunks}
                />
              ))}
              <textarea
                ref={textareaRef}
                rows={1}
                className={`relative max-h-[300px] min-h-[70px] w-full flex-grow resize-none overflow-y-auto bg-transparent p-0 pr-6 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
                placeholder={
                  useChatStore.getState().currentEditorReference?.length
                    ? ""
                    : "Ask DeputyDev to do anything, @ to mention"
                }
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
                autoFocus
              />
            </div>

            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {isLoading ? (
                <button
                  className="flex h-3.5 w-3.5 items-center justify-center rounded bg-red-500"
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
        <div className="flex items-center justify-between text-xs gap-1">
          <div>
            <RepoSelector />
          </div>

          {/* chat and act toggle */}
          <div className="rounded-xl h-4 w-18 flex items-center justify-between bg-[--deputydev-input-background]">
            <button
              className={`transition-all duration-200 ease-in-out font-medium w-[50px] rounded-tl-xl rounded-bl-xl ${chatType === "ask" ? "bg-blue-500/70 rounded-tr-xl rounded-br-xl h-5" : ""}`}
              onClick={() => {
                if (!isLoading) {
                  setChatType("ask")
                }
              }}
              disabled={isLoading}
            >
              Chat
            </button>
            <button
              className={`transition-all duration-200 ease-in-out font-medium w-[50px] rounded-tr-xl rounded-br-xl ${chatType === "write" ? "bg-blue-500/70 rounded-tl-xl rounded-bl-xl h-5" : ""}`}
              onClick={() => {
                if (!isLoading) {
                  setChatType("write")
                }
              }}
              disabled={isLoading}
            >
              Act
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
