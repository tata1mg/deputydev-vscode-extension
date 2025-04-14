// file: webview-ui/src/components/Chat.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { EnterIcon } from "../../components/enterIcon";
import { ChatTypeToggle } from "./chatElements/chatTypeToggle";
import {
  useChatSettingStore,
  useChatStore,
  initialAutocompleteOptions,
} from "../../stores/chatStore";
import { Check } from "lucide-react";
// import Markdown from 'react-markdown';
import { Tooltip } from "react-tooltip";
// import "react-tooltip/dist/react-tooltip.css"; // Import CSS for styling
import { ChatArea } from "./chatMessagesArea";
import RepoSelector from "./chatElements/RepoSelector";
// import { useRepoSelectorStore } from '../../stores/repoSelectorStore';
import { logToOutput } from "@/commandApi";

import Markdown from "react-markdown";
import "../../styles/markdown-body.css";
import { AutocompleteOption, ChatReferenceItem } from "@/types";
import ReferenceChip from "./referencechip";
import { AutocompleteMenu } from "./autocomplete";
import { isEqual as lodashIsEqual, set } from "lodash";
import { ChatUserMessage } from "@/types";
import ProgressBar from "./chatElements/progressBar";
import { keywordSearch, keywordTypeSearch } from "@/commandApi";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useThemeStore } from "@/stores/useThemeStore";

export function ChatUI() {
  // Extract state and actions from the chat store.
  const {
    history: messages,
    current,
    isLoading,
    sendChatMessage,
    cancelChat,
    showSessionsBox,
    ChatAutocompleteOptions,
    progressBars,
    selectedOptionIndex
  } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const { activeRepo } = useWorkspaceStore();
  const { themeKind } = useThemeStore();

  const deputyDevLogo =
  themeKind === "light" || themeKind === "high-contrast-light"
    ? "https://onemg.gumlet.io/dd_logo_dark_name_14_04.png"
    : "https://onemg.gumlet.io/dd_logo_with_name_10_04.png";

  const repoSelectorEmbedding = useMemo(() => {
    if (!activeRepo) return true;
    const activeProgress = progressBars.find((bar) => bar.repo === activeRepo);
    return activeProgress?.status !== "Completed";
  }, [activeRepo, progressBars]);

  // const [repoSelectorDisabled] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [chipEditMode, setChipEditMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const backspaceCountRef = useRef(0);


  useEffect(() => {
    const handleCopy = () => {
      let copiedText = "";

      const activeElement = document.activeElement;

      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        copiedText = activeElement.value.substring(
          activeElement.selectionStart || 0,
          activeElement.selectionEnd || 0,
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

  // Auto-resize the textarea.
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    useChatStore.setState({ lastMessageSentTime: new Date() });
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

  const handleTextAreaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    const options = useChatStore.getState().ChatAutocompleteOptions;

    if (showAutocomplete && options.length > 0) {
      // Prevent default behavior for up/down arrows when autocomplete is active
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const newIndex = e.key === "ArrowUp"
          ? (selectedOptionIndex - 1 + options.length) % options.length
          : (selectedOptionIndex + 1) % options.length;
        useChatStore.setState({ selectedOptionIndex: newIndex });
        return;
      }

      // Handle enter key for autocomplete selection
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedOptionIndex >= 0) {
          const selectedOption = options[selectedOptionIndex];
          if (selectedOption) {
            handleAutoCompleteSelect(selectedOption);
            useChatStore.setState({ selectedOptionIndex: -1 });
          }
          return;
        }
      }
    }

    // Handle regular enter key when not in autocomplete mode
    if (!repoSelectorEmbedding && e.key === "Enter" && !e.shiftKey && !showAutocomplete) {
      e.preventDefault();
      if (!isLoading) {
        handleSend();
      }
    }

    if (e.key === "Backspace") {
      const textarea = e.currentTarget;
      const isEntireTextSelected =
        textarea.selectionStart === 0 &&
        textarea.selectionEnd === textarea.value.length;

      if (isEntireTextSelected) {
        setUserInput("");
        setChipEditMode(false);
        setShowAutocomplete(false);
      }

      if (userInput.endsWith("@") && !isEntireTextSelected) {
        e.preventDefault();
        setShowAutocomplete(false);
        setChipEditMode(false);
        setUserInput(userInput.slice(0, -1));
      }

      if (userInput === "" && !isEntireTextSelected) {
        backspaceCountRef.current += 1;
        if (backspaceCountRef.current === 2) {
          const allChips = [...useChatStore.getState().currentEditorReference];
          if (allChips.length) {
            allChips.pop();
            useChatStore.setState({ currentEditorReference: allChips });
            setTimeout(() => {
              const textarea = textareaRef.current;
              if (textarea) {
                textarea.focus();
              }
            }, 10);
          }
        }
        setTimeout(() => (backspaceCountRef.current = 0), 300);
      }
    }
  };
  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (chipEditMode) {
      const value = e.target.value.split("@")[1];
      const valueArr = value.split(": ");
      if (
        ["file", "directory", "function", "class"].includes(
          valueArr[0].toLowerCase(),
        )
      ) {
        setShowAutocomplete(true);
        keywordTypeSearch({
          type: valueArr[0].toLowerCase(),
          keyword: valueArr[1],
        });
      } else {
        setShowAutocomplete(true);
        if (value !== "") {
          keywordSearch({ keyword: value });
        }
      }
    }
    if (e.target.value.endsWith("@")) {
      useChatStore.setState({
        ChatAutocompleteOptions: initialAutocompleteOptions,
      });
      setShowAutocomplete(true);
      setChipEditMode(true);
    }
    setUserInput(e.target.value);
    autoResize();
  };

  const handleChipDelete = (index: number) => {
    const editorRefs = useChatStore.getState().currentEditorReference;
    const newEditorRefs = editorRefs.filter((ref) => ref.index !== index);
    useChatStore.setState({ currentEditorReference: newEditorRefs });
    setShowAutocomplete(false);
  };

  const handleAutoCompleteSelect = (option: AutocompleteOption) => {
    const currentAutocompleteOptions =
      useChatStore.getState().ChatAutocompleteOptions;
    if (lodashIsEqual(currentAutocompleteOptions, initialAutocompleteOptions)) {
      setUserInput(userInput.split("@")[0] + `@${option.value}`);
    } else {
      const allChips = [...useChatStore.getState().currentEditorReference];
      const chipIndexBeingEdited = useChatStore.getState().chipIndexBeingEdited;
      if (chipIndexBeingEdited == -1) {
        const newChatRefrenceItem: ChatReferenceItem = {
          index: allChips.length,
          type: option.icon,
          keyword: option.icon + ": " + option.value,
          path: option.description,
          chunks: option.chunks,
          value: option.value,
        };
        useChatStore.setState({
          currentEditorReference: [...allChips, newChatRefrenceItem],
        });
        setShowAutocomplete(false);
        setUserInput(userInput.split("@")[0]);
        setChipEditMode(false);
      } else {
        allChips[chipIndexBeingEdited].keyword =
          option.icon + ": " + option.value;
        allChips[chipIndexBeingEdited].type = option.icon;
        allChips[chipIndexBeingEdited].path = option.description;
        allChips[chipIndexBeingEdited].chunks = option.chunks;
        allChips[chipIndexBeingEdited].value = option.value;
      }
    }
    useChatStore.setState({ chipIndexBeingEdited: -1 });
    useChatStore.setState({ selectedOptionIndex: -1 });
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
      }
    }, 10);
  };

  useEffect(() => {
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }, [userInput]);

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
              
                <img
                  src={deputyDevLogo}
                  alt="DeputyDev Logo"
                  className="h-10 w-auto px-4 opacity-90"
                />
                {/* <h1 className="animate-gradient bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text px-4 text-3xl font-bold text-transparent">
                  Develop with DeputyDev
                </h1> */}
              </div>
              {!repoSelectorEmbedding && (
                <div className="h-[128px] px-4 fade-in">
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
              )}
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

          {messages.length === 0 && !showAutocomplete &&
            <div className="px-4">
              <p className="mb-2 mt-4 text-center text-xs text-gray-500">
                DeputyDev is powered by AI. It can make mistakes. Please double
                check all output.
              </p>
            </div>
          }

          {activeRepo ? (
            <div className="mb-[2px] w-full">
              <ProgressBar progressBars={progressBars} />
            </div>
          ) : (
            <div className="mb-[4px] w-full text-center text-sm">
              To proceed, please import a project into your workspace!
            </div>
          )}

          {/* The textarea remains enabled even when a response is pending */}
          <div className="relative w-full">
            <div className="mb-1 flex flex-wrap items-center gap-1 rounded border border-[--vscode-commandCenter-inactiveBorder] bg-[--deputydev-input-background] p-2">
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
                onKeyDown={handleTextAreaKeyDown}
                disabled={repoSelectorEmbedding}
                {...(repoSelectorEmbedding &&
                  activeRepo && {
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
        <div className="flex items-center justify-between gap-2 text-xs">
          <RepoSelector />
          <ChatTypeToggle />
        </div>
      </div>
    </div>
  );
}
