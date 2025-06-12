// file: webview-ui/src/components/Chat.tsx
import {
  Check,
  Sparkles,
  CornerDownLeft,
  Loader2,
  CircleStop,
  Globe,
  AtSign,
  Image,
  X,
} from 'lucide-react';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import {
  initialAutocompleteOptions,
  useChatSettingStore,
  useChatStore,
} from '../../stores/chatStore';
import { ChatTypeToggle } from './chatElements/chatTypeToggle';
import { Tooltip } from 'react-tooltip';
// import "react-tooltip/dist/react-tooltip.css"; // Import CSS for styling
import RepoSelector from './chatElements/RepoSelector';
import { ChatArea } from './chatMessagesArea';
import {
  keywordSearch,
  keywordTypeSearch,
  logToOutput,
  getSavedUrls,
  urlSearch,
  enhanceUserQuery,
  uploadFileToS3,
  showVsCodeMessageBox,
  getWorkspaceState,
} from '@/commandApi';
import { useThemeStore } from '@/stores/useThemeStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AutocompleteOption, ChatReferenceItem, ChatUserMessage } from '@/types';
import { isEqual as lodashIsEqual } from 'lodash';
import '../../styles/markdown-body.css';
import { AutocompleteMenu } from './autocomplete';
import ProgressBar from './chatElements/progressBar';
import ReferenceChip from './referencechip';
import ModelSelector from './chatElements/modelSelector';
import FeaturesBar from './chatElements/features_bar';
import { useMcpStore } from '@/stores/mcpStore';

export function ChatUI() {
  // Extract state and actions from the chat store.
  const {
    history: messages,
    current,
    userInput,
    isLoading,
    sendChatMessage,
    cancelChat,
    showSessionsBox,
    ChatAutocompleteOptions,
    progressBars,
    selectedOptionIndex,
    enhancingUserQuery,
    enhancedUserQuery,
    imageUploadProgress,
  } = useChatStore();
  const { chatType, setChatType } = useChatSettingStore();
  const { activeRepo } = useWorkspaceStore();
  const { themeKind } = useThemeStore();
  const { showAllMCPServers, showMCPServerTools } = useMcpStore();

  const deputyDevLogo =
    themeKind === 'light' || themeKind === 'high-contrast-light'
      ? 'https://onemg.gumlet.io/dd_logo_dark_name_14_04.png'
      : 'https://onemg.gumlet.io/dd_logo_with_name_10_04.png';
  const borderClass =
    themeKind === 'high-contrast' || themeKind === 'high-contrast-light'
      ? 'outline outline-[1px]  outline-[--deputydev-button-border] '
      : '';

  const repoSelectorEmbedding = useMemo(() => {
    if (!activeRepo) return true;
    const activeProgress = progressBars.find((bar) => bar.repo === activeRepo);
    return activeProgress?.status !== 'Completed';
  }, [activeRepo, progressBars]);

  // const [repoSelectorDisabled] = useState(false);
  const setUserInput = (val: string) => useChatStore.setState({ userInput: val });
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showAddNewButton, setShowAddNewButton] = useState(false);
  const [chipEditMode, setChipEditMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const backspaceCountRef = useRef(0);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [expandedImageIndex, setExpandedImageIndex] = useState<number>(-1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [maxSize, setMaxSize] = useState<number>(5 * 1024 * 1024); // Default 5MB
  const [maxFiles, setMaxFiles] = useState<number>(5); // Default 5 files

  const handleGlobeToggle = () => {
    useChatStore.setState({ search_web: !useChatStore.getState().search_web });
  };

  useEffect(() => {
    const handleCopy = () => {
      let copiedText = '';

      const activeElement = document.activeElement;

      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        copiedText = activeElement.value.substring(
          activeElement.selectionStart || 0,
          activeElement.selectionEnd || 0
        );
      } else {
        copiedText = window.getSelection()?.toString() || '';
      }

      logToOutput('info', `Copied: ${JSON.stringify(copiedText)}`);
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);

  // Function to handle showing all sessions

  // Auto-resize the textarea.
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(70, Math.min(el.scrollHeight, 300))}px`;
  };

  const handleSend = async () => {
    if (enhancingUserQuery) {
      return;
    }
    useChatStore.setState({ lastMessageSentTime: new Date() });
    if (!userInput.trim() || isLoading || repoSelectorEmbedding) return;

    const resetTextareaHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = '70px';
      }
    };

    useChatStore.setState({ showSessionsBox: false });

    const message = userInput.trim();
    const editorReferences = [...useChatStore.getState().currentEditorReference];
    const s3References = [...useChatStore.getState().s3Objects];
    setUserInput('');
    setImagePreviews([]);
    fileInputRef.current!.value = '';
    timeoutRef.current = null;
    useChatStore.setState({ s3Objects: [] });
    useChatStore.setState({ currentEditorReference: [] });
    resetTextareaHeight();

    try {
      await sendChatMessage(message, editorReferences, () => {}, s3References);
    } catch (error) {
      // Handle error if needed
    }
  };

  useEffect(() => {
    if (enhancedUserQuery && enhancingUserQuery) {
      setUserInput(enhancedUserQuery);
      useChatStore.setState({ enhancingUserQuery: false });
    }
  }, [enhancedUserQuery]);

  useEffect(() => {
    setTimeout(autoResize, 0);
  }, [userInput]);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].type === 'TEXT_BLOCK') {
      const lastMessage = messages[messages.length - 1] as ChatUserMessage;
      if (lastMessage.actor === 'USER') {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
      }
    }
  }, [messages]);

  const handleTextAreaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const options = useChatStore.getState().ChatAutocompleteOptions;

    if (showAutocomplete && options.length > 0) {
      // Prevent default behavior for up/down arrows when autocomplete is active
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex =
          e.key === 'ArrowUp'
            ? (selectedOptionIndex - 1 + options.length) % options.length
            : (selectedOptionIndex + 1) % options.length;
        useChatStore.setState({ selectedOptionIndex: newIndex });
        return;
      }

      // Handle enter key for autocomplete selection
      if (e.key === 'Enter') {
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
    if (!repoSelectorEmbedding && e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
      e.preventDefault();
      if (!isLoading) {
        handleSend();
      }
    }

    if (e.key === 'Backspace') {
      const textarea = e.currentTarget;
      const isEntireTextSelected =
        textarea.selectionStart === 0 && textarea.selectionEnd === textarea.value.length;

      if (isEntireTextSelected) {
        setUserInput('');
        setChipEditMode(false);
        setShowAutocomplete(false);
      } else if (userInput.endsWith('@') && !isEntireTextSelected) {
        e.preventDefault();
        setShowAutocomplete(false);
        setChipEditMode(false);
        setUserInput(userInput.slice(0, -1));
      } else if (userInput === '' && !isEntireTextSelected) {
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
      const value = e.target.value.split('@')[1];
      const valueArr = value.split(': ');
      if (['file', 'directory', 'function', 'class'].includes(valueArr[0].toLowerCase())) {
        setShowAutocomplete(true);
        keywordTypeSearch({
          type: valueArr[0].toLowerCase(),
          keyword: valueArr[1],
        });
      } else if (valueArr[0].toLowerCase() === 'url') {
        setShowAutocomplete(true);
        valueArr[1] &&
          urlSearch({
            keyword: valueArr[1].trim(),
          });
      } else {
        setShowAutocomplete(true);
        if (value !== '' && !value.startsWith('url:')) {
          keywordSearch({ keyword: value });
        }
      }
    }
    if (e.target.value.endsWith('@')) {
      useChatStore.setState({
        ChatAutocompleteOptions: initialAutocompleteOptions,
      });
      setShowAddNewButton(false);
      setShowAutocomplete(true);
      setChipEditMode(true);
    }
    setUserInput(e.target.value);
  };

  const handleChipDelete = (index: number) => {
    const editorRefs = useChatStore.getState().currentEditorReference;
    const newEditorRefs = editorRefs.filter((ref) => ref.index !== index);
    useChatStore.setState({ currentEditorReference: newEditorRefs });
    setShowAutocomplete(false);
  };

  const handleAutoCompleteSelect = (option: AutocompleteOption) => {
    const currentAutocompleteOptions = useChatStore.getState().ChatAutocompleteOptions;
    if (lodashIsEqual(currentAutocompleteOptions, initialAutocompleteOptions)) {
      setUserInput(userInput.split('@')[0] + `@${option.value}`);
      if (option.icon === 'url') {
        getSavedUrls();
        setShowAddNewButton(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      const allChips = [...useChatStore.getState().currentEditorReference];
      const chipIndexBeingEdited = useChatStore.getState().chipIndexBeingEdited;
      if (chipIndexBeingEdited == -1) {
        const newChatRefrenceItem: ChatReferenceItem = {
          index: allChips.length,
          type: option.icon,
          keyword: option.icon + ': ' + option.value,
          path: option.description,
          chunks: option.chunks,
          value: option.value,
          url: option.url,
        };
        useChatStore.setState({
          currentEditorReference: [...allChips, newChatRefrenceItem],
        });
        setShowAutocomplete(false);
        setUserInput(userInput.split('@')[0]);
        setChipEditMode(false);
      } else {
        allChips[chipIndexBeingEdited].keyword = option.icon + ': ' + option.value;
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

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (reenableTimer) clearTimeout(reenableTimer);
    };
  }, []);

  // Scroll to bottom when new messages arrive (if auto-scroll is enabled)
  useEffect(() => {
    // console.log("messages updated:", messages);
    if (isAutoScrollEnabled) {
      // Use setTimeout to ensure all content is rendered
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [messages, current?.content?.text, isAutoScrollEnabled]);

  useEffect(() => {
    const fetchImageUploadConfig = async () => {
      try {
        const mainConfig = await getWorkspaceState({ key: 'configData' });
        if (mainConfig) {
          const maxSize = mainConfig['CHAT_IMAGE_UPLOAD']['MAX_BYTES'];
          const maxFiles = mainConfig['CHAT_IMAGE_UPLOAD']['MAX_FILES'];

          if (maxFiles && typeof maxFiles === 'number') {
            setMaxFiles(maxFiles);
          }
          if (maxSize && typeof maxSize === 'number' && maxFiles && typeof maxFiles === 'number') {
            setMaxSize(maxSize * maxFiles);
          }
        }
      } catch (error) {
        console.error('Failed to fetch image upload config:', error);
      }
    };

    fetchImageUploadConfig();
  }, []);

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
                    <p className="mb-2 text-lg text-gray-400">You are ready to go.</p>
                    <Check className="mb-1 animate-pulse text-sm text-green-500" />
                  </div>
                  <p className="text-md">
                    Ask questions about your repository or instantly generate code, tests, and
                    documentation
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-[160px] h-full overflow-auto px-4">
        <ChatArea />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Layer */}
      <div className="absolute bottom-0 left-0 right-0 mx-2 mb-0 mt-3.5">
        <div className="">
          {showAutocomplete && (
            <div className="w-full">
              <AutocompleteMenu
                showAddNewButton={showAddNewButton}
                options={ChatAutocompleteOptions}
                onSelect={handleAutoCompleteSelect}
              />
            </div>
          )}

          {messages.length === 0 &&
            !showAutocomplete &&
            !showAllMCPServers &&
            !showMCPServerTools && (
              <div className="px-4">
                <p className="mb-1 mt-4 text-center text-xs text-gray-500">
                  DeputyDev is powered by AI. It can make mistakes. Please double check all output.
                </p>
              </div>
            )}

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
            {!showAutocomplete && <FeaturesBar />}
            <div
              className={`mb-1 flex flex-wrap items-center gap-1 rounded bg-[--deputydev-input-background] p-2 focus-within:outline focus-within:outline-[1px] focus-within:outline-[--vscode-list-focusOutline] ${borderClass}`}
            >
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
                    chip.index === useChatStore.getState().currentEditorReference.length - 1
                  }
                  setShowAutoComplete={setShowAutocomplete}
                  chunks={chip.chunks}
                  url={chip.url}
                />
              ))}

              {imagePreviews.length > 0 && (
                <div className="mb-2 flex max-w-full flex-wrap gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div
                      key={index}
                      className={`group relative transition-all duration-500 ease-in-out ${
                        expandedImageIndex === index ? 'h-32 w-32' : 'h-12 w-12'
                      }`}
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-lg border-2 border-gray-200 shadow-sm">
                        <img
                          onClick={() => {
                            if (expandedImageIndex !== index) {
                              if (timeoutRef.current) clearTimeout(timeoutRef.current);
                              setExpandedImageIndex(index);
                              timeoutRef.current = window.setTimeout(() => {
                                setExpandedImageIndex(-1);
                              }, 5000);
                            } else {
                              setExpandedImageIndex(-1);
                              if (timeoutRef.current) clearTimeout(timeoutRef.current);
                            }
                          }}
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                        />

                        {/* Circular loader overlay */}
                        {imageUploadProgress !== null &&
                          imageUploadProgress < 100 &&
                          index === imagePreviews.length - 1 && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                              <svg
                                className="h-4 w-4 animate-spin text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                ></path>
                              </svg>
                            </div>
                          )}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => {
                          const newPreviews = imagePreviews.filter((_, i) => i !== index);
                          const newS3Objects = useChatStore
                            .getState()
                            .s3Objects.filter((_, i) => i !== index);
                          setImagePreviews(newPreviews);
                          useChatStore.setState({ s3Objects: newS3Objects });

                          // Reset expanded state if needed
                          if (expandedImageIndex === index) {
                            setExpandedImageIndex(-1);
                          } else if (expandedImageIndex > index) {
                            setExpandedImageIndex(expandedImageIndex - 1);
                          }

                          // Clear file input if no images left
                          if (newPreviews.length === 0 && fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        title={`Remove image ${index + 1}`}
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X className="h-2.5 w-2.5" strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={1}
                className={`no-scrollbar relative max-h-[300px] min-h-[70px] w-full flex-grow resize-none overflow-y-auto bg-transparent p-0 pb-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
                placeholder={
                  useChatStore.getState().currentEditorReference?.length
                    ? ''
                    : 'Ask DeputyDev to do anything, @ to mention'
                }
                value={userInput}
                onChange={handleTextAreaChange}
                onKeyDown={handleTextAreaKeyDown}
                disabled={repoSelectorEmbedding || enhancingUserQuery}
                {...(repoSelectorEmbedding &&
                  activeRepo && {
                    'data-tooltip-id': 'repo-tooltip',
                    'data-tooltip-content': 'Please wait, DeputyDev is initializing.',
                  })}
                autoFocus
              />
            </div>

            <div className="absolute bottom-1 left-1 flex items-center gap-1">
              <RepoSelector />
            </div>

            <div className="absolute bottom-1 right-2.5 flex items-center gap-1">
              <button
                className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10"
                data-tooltip-id="sparkles-tooltip"
                data-tooltip-content="Add Context"
                data-tooltip-place="top-start"
                disabled={repoSelectorEmbedding || enhancingUserQuery}
                onClick={() => {
                  // Add @ to the end of the current input value
                  const newValue = userInput + '@';

                  // Update store
                  setUserInput(newValue);

                  // Trigger the change to activate autocomplete
                  setShowAutocomplete(true);
                  setChipEditMode(true);

                  // Make sure to update textarea and focus
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.focus();

                      // Set cursor position to the end
                      textareaRef.current.selectionStart = newValue.length;
                      textareaRef.current.selectionEnd = newValue.length;
                    }
                  }, 0);

                  // Set autocomplete options
                  useChatStore.setState({
                    ChatAutocompleteOptions: initialAutocompleteOptions,
                  });
                  setShowAddNewButton(false);
                }}
              >
                <AtSign className="h-4 w-4" />
              </button>

              <button
                className={`flex items-center justify-center rounded p-1 ${
                  useChatStore.getState().search_web
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'hover:bg-slate-400 hover:bg-opacity-10'
                }`}
                onClick={handleGlobeToggle}
                data-tooltip-id="sparkles-tooltip"
                data-tooltip-content={`${useChatStore.getState().search_web ? 'Disable Web Search' : 'Enable Web Search'}`}
                data-tooltip-place="top-start"
              >
                <Globe className="h-4 w-4" />
              </button>

              {/* <button className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10"
                data-tooltip-id="sparkles-tooltip"
                data-tooltip-content="Upload image"
                data-tooltip-place="top-start"
              >
                <Image className="h-4 w-4" />
              </button> */}
              <input
                type="file"
                accept="image/*"
                multiple
                id="image-upload"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    // Check if adding these files exceeds the limit
                    const currentCount = imagePreviews.length;
                    if (currentCount + files.length > maxFiles) {
                      showVsCodeMessageBox(
                        'error',
                        `Maximum ${maxFiles} images allowed. You can upload ${maxFiles - currentCount} more.`
                      );
                      return;
                    }

                    // Check file sizes
                    const oversizedFiles = files.filter((file) => file.size > maxSize);
                    if (oversizedFiles.length > 0) {
                      showVsCodeMessageBox(
                        'error',
                        `${oversizedFiles.length} file(s) exceed 25 MB limit. Please upload smaller files.`
                      );
                      return;
                    }

                    // Create previews for all valid files
                    const newPreviews: string[] = [];
                    files.forEach((file) => {
                      const previewUrl = URL.createObjectURL(file);
                      newPreviews.push(previewUrl);
                    });

                    setImagePreviews((prev) => [...prev, ...newPreviews]);

                    // Upload all files
                    files.forEach((file) => {
                      uploadFileToS3(file);
                    });
                  }
                }}
              />

              <label
                htmlFor="image-upload"
                className="flex cursor-pointer items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10"
                data-tooltip-id="upload-tooltip"
                data-tooltip-content={
                  imagePreviews.length >= maxFiles
                    ? `Maximum ${maxFiles} images allowed`
                    : `Upload Images (${imagePreviews.length}/${maxFiles})`
                }
                data-tooltip-place="top-start"
              >
                <Image className="h-4 w-4" />
              </label>

              {enhancingUserQuery ? (
                <div className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <button
                  className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10 disabled:cursor-not-allowed"
                  onClick={() => {
                    enhanceUserQuery(userInput);
                    useChatStore.setState({ enhancingUserQuery: true });
                  }}
                  data-tooltip-id="sparkles-tooltip"
                  data-tooltip-content={`${userInput ? 'Enhance your prompt' : 'Please write your prompt first.'}`}
                  data-tooltip-place="top-start"
                  disabled={!userInput}
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              )}

              {isLoading ? (
                <button
                  className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10"
                  onClick={cancelChat}
                >
                  <CircleStop className="h-4 w-4 text-red-500" />
                </button>
              ) : (
                <button
                  className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10"
                  onClick={() => {
                    if (!isLoading) {
                      handleSend();
                    }
                  }}
                >
                  <CornerDownLeft className="h-4 w-4" />
                </button>
              )}
            </div>
            <Tooltip id="repo-tooltip" />
            <Tooltip id="sparkles-tooltip" />
            <Tooltip id="upload-tooltip" />
          </div>
        </div>

        {/* Chat Type Toggle and RepoSelector */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <ModelSelector />
          <ChatTypeToggle />
        </div>
      </div>
    </div>
  );
}
