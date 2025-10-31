import {
  apiChat,
  apiStopChat,
  logToOutput,
  onActionRequired,
  showErrorMessage,
} from '@/commandApi';
import { useChatSettingStore } from '@/stores/chatSettingStore';
import _ from 'lodash';
import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';

import {
  ActiveFileChatReferenceItem,
  AutocompleteOption,
  ChatAssistantMessage,
  ChatCodeBlockMessage,
  ChatCompleteMessage,
  ChatErrorMessage,
  ChatMessage,
  ChatMetaData,
  ChatReferenceItem,
  ChatStatus,
  ChatTaskPlanMessage,
  ChatTerminalNoShell,
  ChatThinkingMessage,
  ChatToolUseMessage,
  ChatType,
  ChatUserMessage,
  LLMModels,
  S3Object,
  ToolProps,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useActiveFileStore } from './activeFileStore';
import { persistStorage } from './lib';
import { useLLMModelStore } from './llmModelStore';
import { useSettingsStore } from './settingsStore';
import useExtensionStore from './useExtensionStore';
import { useWorkspaceStore } from './workspaceStore';
import { ChangedFilesGroup } from './changedFilesStore';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
export const initialAutocompleteOptions: AutocompleteOption[] = [
  {
    icon: 'directory',
    label: 'Directory',
    value: 'Directory: ',
    description: 'A folder containing files and subfolders',
    chunks: [],
  },
  {
    icon: 'file',
    label: 'File',
    value: 'File: ',
    description: 'A single file such as a document or script',
    chunks: [],
  },
  {
    icon: 'function',
    label: 'Function',
    value: 'Function: ',
    description: 'A short piece of reusable code',
    chunks: [],
  },
  {
    icon: 'class',
    label: 'Class',
    value: 'Class: ',
    description: 'A short piece of reusable class code',
    chunks: [],
  },
  {
    icon: 'url',
    label: 'URL',
    value: 'url: ',
    description: 'A web address or link to a resource',
    chunks: [],
  },
];

/*===========================================================================
  Chat Store
===========================================================================*/

type ChatSession = {
  // your previous chat-local fields:
  history: ChatMessage[];
  current: ChatAssistantMessage | undefined;
  userInput: string;
  isLoading: boolean;
  showSkeleton: boolean;
  currentEditorReference: ChatReferenceItem[];
  ChatAutocompleteOptions: AutocompleteOption[];
  chipIndexBeingEdited: number;
  forceUpgradeData: { url: string; upgradeVersion: string };
  selectedOptionIndex: number;
  enhancingUserQuery: boolean;
  enhancedUserQuery: string;
  webSearchInToolUse: boolean;
  search_web: boolean;
  imageUploadProgress: number;
  s3Objects: S3Object[];
  showGeneratingEffect: boolean;
  disableStopButton: boolean;
  // below are new fields for parallel/multi-chat
  status: ChatStatus;
  repoPath: string | null;
  sessionId?: number;
  summary?: string;
  activeModel: LLMModels | null;
  chatType: ChatType;
  changedFiles: number;
};

type MultiChatStore = {
  /** All chat sessions keyed by chatId */
  chats: Record<string, ChatSession>;
  /** The active chatId */
  currentChatId: string | undefined;

  /** Session lifecycle */
  createChat: () => void;
  deleteChat: (chatId: string) => void;
  switchChat: (chatId: string) => void;

  /** Helpers */
  getChat: (chatId: string) => ChatSession | undefined;
  getCurrentChat: () => ChatSession | undefined;

  /** Actions (per chat) */
  clearChat: (chatId?: string) => Promise<void>;
  sendChatMessage: (
    chatId: string,
    message: string,
    focusItems: ChatReferenceItem[],
    attachments?: S3Object[],
    retryChat?: boolean,
    retry_payload?: any,
    create_new_workspace_payload?: any,
    retryReason?: string
  ) => Promise<void>;
  cancelChat: (chatId?: string) => void;
};

/** ============================================================================
 * HELPERS
 * ============================================================================ */

const makeInitialChatSession = (): ChatSession => ({
  history: [],
  current: undefined,
  userInput: '',
  isLoading: false,
  showSkeleton: false,
  currentEditorReference: [],
  ChatAutocompleteOptions: initialAutocompleteOptions,
  chipIndexBeingEdited: -1,
  forceUpgradeData: { url: '', upgradeVersion: '' },
  selectedOptionIndex: -1,
  enhancingUserQuery: false,
  enhancedUserQuery: '',
  webSearchInToolUse: false,
  search_web: false,
  imageUploadProgress: 0,
  s3Objects: [],
  showGeneratingEffect: false,
  disableStopButton: true,
  sessionId: undefined,
  status: { type: 'in_progress', message: undefined },
  summary: undefined,
  repoPath: useWorkspaceStore.getState().activeRepo,
  chatType: useChatSettingStore.getState().chatType,
  activeModel: useLLMModelStore.getState().activeModel,
  changedFiles: 0,
});

/**
 * Safe chat updater. Creates the chat if it doesn't exist.
 */
function produceChatUpdate(
  state: MultiChatStore,
  chatId: string,
  updater: (prev: ChatSession) => ChatSession
): MultiChatStore {
  const prev = state.chats[chatId] ?? makeInitialChatSession();
  const next = updater(prev);
  return {
    ...state,
    chats: {
      ...state.chats,
      [chatId]: next,
    },
  };
}

export const FALLBACK_CHAT_ID = 'default';

export const useChatStore = create(
  persist(
    combine(
      {
        chats: {
          [FALLBACK_CHAT_ID]: makeInitialChatSession(),
        } as Record<string, ChatSession>,
        currentChatId: FALLBACK_CHAT_ID,
      },
      (set, get) => {
        // helper
        const ensureFallback = () => {
          const state = get();
          if (!state.chats[FALLBACK_CHAT_ID]) {
            set((s) => ({
              ...s,
              chats: { ...s.chats, [FALLBACK_CHAT_ID]: makeInitialChatSession() },
            }));
          }
        };

        // small helper to update one chat slice
        const setChat = (chatId: string, updater: (prev: ChatSession) => ChatSession) => {
          set((state) => produceChatUpdate(state as MultiChatStore, chatId, updater));
        };

        // Resolve a chatId (fallback to current)
        const resolveChatId = (maybeId?: string) => {
          const id = maybeId ?? get().currentChatId ?? null;
          if (!id) throw new Error('No active chatId. Call createChat() or switchChat() first.');
          return id;
        };

        return {
          // --------------------------
          // Session lifecycle
          // --------------------------
          async createChat(isHistory = false) {
            set((state) => {
              const currentChatId = state.currentChatId;
              const currentChat = currentChatId ? state.chats[currentChatId] : undefined;

              // CASE 1: No current chat
              if (!currentChatId || !currentChat) {
                const newChatId = uuidv4();
                return {
                  ...state,
                  chats: { ...state.chats, [newChatId]: makeInitialChatSession() },
                  currentChatId: newChatId,
                };
              }

              // CASE 2: Current chat exists but is empty
              if (currentChat.history.length === 0) {
                const newChatId = uuidv4();
                return {
                  ...state,
                  chats: { ...state.chats, [newChatId]: makeInitialChatSession() },
                  currentChatId: newChatId,
                };
              }

              // CASE 3: Current chat is from history view
              if (isHistory) {
                const newChatId = uuidv4();
                return {
                  ...state,
                  chats: { ...state.chats, [newChatId]: makeInitialChatSession() },
                  currentChatId: newChatId,
                };
              }

              // CASE 4: Otherwise, leave state unchanged
              return state;
            });
          },

          deleteChat(chatId: string) {
            set((state) => {
              const { [chatId]: _, ...rest } = state.chats;

              // if fallback deleted, recreate it
              const chats =
                chatId === FALLBACK_CHAT_ID
                  ? { ...rest, [FALLBACK_CHAT_ID]: makeInitialChatSession() }
                  : rest;

              const nextCurrent =
                state.currentChatId === chatId ? FALLBACK_CHAT_ID : state.currentChatId;

              return { ...state, chats, currentChatId: nextCurrent };
            });
          },

          switchChat(chatId: string) {
            // add a lot of consoles for debugging
            set((state) => {
              ensureFallback();
              if (!state.chats[chatId]) {
                return {
                  ...state,
                  chats: { ...state.chats, [chatId]: makeInitialChatSession() },
                  currentChatId: chatId,
                };
              }
              const chat = state.chats[chatId];
              useChatSettingStore.getState().setChatType(chat.chatType);
              useWorkspaceStore.getState().setActiveRepo(chat.repoPath);
              useLLMModelStore.getState().setActiveModel(chat.activeModel?.name ?? null);

              return { ...state, currentChatId: chatId };
            });
          },

          // --------------------------
          // Helpers
          // --------------------------

          getChat(chatId: string) {
            ensureFallback();
            return get().chats[chatId];
          },

          getCurrentChat() {
            ensureFallback();
            return get().chats[get().currentChatId ?? FALLBACK_CHAT_ID];
          },

          // --------------------------
          // Actions (per chat)
          // --------------------------
          async clearChat(chatId?: string) {
            const id = resolveChatId(chatId);
            setChat(id, () => ({
              ...makeInitialChatSession(),
            }));
          },

          updateCurrentChat(partial: Partial<ChatSession>) {
            const id = get().currentChatId ?? FALLBACK_CHAT_ID;
            set((state) =>
              produceChatUpdate(state as MultiChatStore, id, (prev) => ({
                ...prev,
                ...partial,
              }))
            );
          },
          updateChatChangedFiles(sessionId: number, count: number) {
            const state = get();
            const chatId = Object.keys(state.chats).find(
              (id) => state.chats[id].sessionId === sessionId
            );
            if (!chatId) return;
            setChat(chatId, (prev) => ({ ...prev, changedFiles: count }));
          },

          async sendChatMessage(
            chatId: string,
            message: string,
            focusItems: ChatReferenceItem[],
            attachments: S3Object[] = [],
            retryChat?: boolean,
            retry_payload?: any,
            create_new_workspace_payload?: any,
            retryReason?: string
          ) {
            const id = resolveChatId(chatId);
            if (id === FALLBACK_CHAT_ID) {
              console.log(`Fallback chat ID detected`);
              return;
            }
            setChat(id, (prev) => ({
              ...prev,
              status: { type: 'in_progress', message: undefined },
            }));
            logToOutput('info', `sendChatMessage[${id}]: ${message}`);

            let stream: AsyncIterable<any>;
            if (create_new_workspace_payload) {
              // per-chat flag flip
              setChat(id, (prev) => ({ ...prev, showGeneratingEffect: true }));
              stream = apiChat(create_new_workspace_payload, id);
            } else {
              const session = get().chats[id];
              const history = session.history;

              // active file metadata (global store as before)
              const {
                activeFileUri,
                startLine: activeStartLine,
                endLine: activeEndLine,
                disableActiveFile,
              } = useActiveFileStore.getState();

              let activeFileChatReferenceItem: ActiveFileChatReferenceItem | undefined = undefined;
              if (!disableActiveFile && activeFileUri) {
                activeFileChatReferenceItem = {
                  type: 'file',
                  activeFileUri: activeFileUri,
                  startLine: activeStartLine,
                  endLine: activeEndLine,
                };
              }

              // last ask_user_input tool chip (from this chat's history)
              let lastAskUserInput: { tool_name: string; tool_use_id: string } | undefined;
              const lastMsg = history[history.length - 1];
              if (
                lastMsg?.type === 'TOOL_CHIP_UPSERT' &&
                lastMsg.content?.tool_name === 'ask_user_input'
              ) {
                lastAskUserInput = {
                  tool_name: lastMsg.content.tool_name,
                  tool_use_id: lastMsg.content.tool_use_id,
                };
              }

              // build user message
              const userMessage: ChatUserMessage = {
                type: 'TEXT_BLOCK',
                content: { text: message },
                focusItems,
                attachments,
                actor: 'USER',
                lastMessageSentTime: new Date().toISOString(),
                activeFileReference: activeFileChatReferenceItem,
              };

              // push user message & open current assistant
              if (!retryChat) {
                setChat(id, (prev) => ({
                  ...prev,
                  history: [...prev.history, userMessage],
                  current: {
                    type: 'TEXT_BLOCK',
                    content: { text: '' },
                    actor: 'ASSISTANT',
                  },
                }));
              }

              // cleanup pending statuses / remove errors
              setChat(id, (prev) => {
                const newHistory = [...prev.history];
                const last = newHistory[newHistory.length - 1];

                if (last?.type === 'TOOL_CHIP_UPSERT') {
                  const toolMsg = last as ChatToolUseMessage;
                  newHistory[newHistory.length - 1] = {
                    ...toolMsg,
                    content: {
                      ...toolMsg.content,
                      status: 'aborted',
                      toolStateMetaData: {
                        terminal: {
                          ...toolMsg.content.toolStateMetaData?.terminal,
                          terminal_approval_required:
                            toolMsg.content.tool_name === 'execute_command'
                              ? false
                              : toolMsg.content.toolStateMetaData?.terminal
                                  ?.terminal_approval_required,
                        },
                      },
                    },
                  };
                }

                if (
                  (last?.type === 'CODE_BLOCK_STREAMING' || last?.type === 'THINKING') &&
                  (last as any).status === 'pending'
                ) {
                  newHistory[newHistory.length - 1] = {
                    ...(last as any),
                    status: 'aborted',
                  };
                }

                return {
                  ...prev,
                  history: newHistory.filter((m) => m.type !== 'ERROR'),
                };
              });

              // show skeleton
              setChat(id, (prev) => ({ ...prev, isLoading: true, showSkeleton: true }));

              // active file reference payload
              const activeFile = useActiveFileStore.getState().activeFileUri;
              const startLine = useActiveFileStore.getState().startLine;
              const endLine = useActiveFileStore.getState().endLine;
              const activeFileReference: {
                active_file: string;
                start_line?: number;
                end_line?: number;
              } = {
                active_file: activeFile || '',
                start_line: startLine,
                end_line: endLine,
              };

              // Build payload (kept global model/settings as before)
              const payload: any = {
                search_web: get().chats[id]?.search_web ?? false,
                llm_model: useLLMModelStore.getState().activeModel?.name,
                reasoning: useLLMModelStore.getState().getActiveReasoning(),
                query: message,
                focusItems: userMessage.focusItems,
                sessionId: get().chats[id].sessionId,
                repoPath: useWorkspaceStore.getState().activeRepo,
                is_tool_response: false,
                write_mode: get().chats[id].chatType === 'write',
                is_inline: useChatSettingStore.getState().chatSource === 'inline-chat',
                attachments: attachments.map((ref) => ({ attachment_id: ref.key })),
                ...(disableActiveFile === false && { active_file_reference: activeFileReference }),
              };

              if (lastAskUserInput) {
                payload.is_tool_response = true;
                payload.batch_tool_responses = [
                  {
                    tool_name: lastAskUserInput.tool_name,
                    tool_use_id: lastAskUserInput.tool_use_id,
                    response: { user_response: message },
                  },
                ];
              }

              if (retryChat) {
                logToOutput('info', `retrying chat with payload: ${JSON.stringify(retry_payload)}`);
                retry_payload['reasoning'] = useLLMModelStore.getState().getActiveReasoning();
                retry_payload['repoPath'] = useWorkspaceStore.getState().activeRepo;
                if (retryReason) retry_payload['retry_reason'] = retryReason;
                stream = apiChat(retry_payload, id);
              } else {
                stream = apiChat(payload, id);
              }
            }

            // STREAM HANDLER — capture chatId in closure so every event updates the right slice
            try {
              for await (const event of stream) {
                switch (event.name) {
                  case 'STREAM_START':
                    setChat(id, (prev) => ({
                      ...prev,
                      disableStopButton: true,
                    }));
                    break;

                  case 'RESPONSE_METADATA': {
                    setChat(id, (prev) => ({
                      ...prev,
                      history: [
                        ...prev.history,
                        {
                          type: 'RESPONSE_METADATA',
                          content: event.data,
                        } as ChatMetaData,
                      ],
                      sessionId: event.data.session_id,
                      disableStopButton: false,
                    }));
                    logToOutput('info', `query complete ${JSON.stringify(event.data)}`);
                    break;
                  }

                  // SUMMARY
                  case 'SESSION_SUMMARY': {
                    setChat(id, (prev) => ({
                      ...prev,
                      sessionId: event.data.session_id,
                      summary: event.data.summary,
                    }));
                    logToOutput('info', `Summary received: ${JSON.stringify(event.data)}`);
                    break;
                  }

                  // TEXT
                  case 'TEXT_START': {
                    setChat(id, (prev) => ({
                      ...prev,
                      current:
                        prev.current ??
                        ({
                          type: 'TEXT_BLOCK',
                          content: { text: '' },
                          actor: 'ASSISTANT',
                        } as ChatAssistantMessage),
                      showGeneratingEffect: false,
                    }));
                    break;
                  }
                  case 'TEXT_DELTA': {
                    const textChunk = (event.data as any)?.text || '';
                    setChat(id, (prev) => ({
                      ...prev,
                      showSkeleton: false,
                      showGeneratingEffect: false,
                      current: prev.current
                        ? {
                            ...prev.current,
                            content: { text: prev.current.content.text + textChunk },
                          }
                        : prev.current,
                    }));
                    break;
                  }
                  case 'TEXT_BLOCK_END': {
                    setChat(id, (prev) => {
                      if (!prev.current) return prev;
                      const newMsg = { ...prev.current };
                      newMsg.content.text = newMsg.content.text.replace(/(\r?\n\s*)+$/, '');
                      return {
                        ...prev,
                        history: [...prev.history, newMsg],
                        current: undefined,
                        showGeneratingEffect: true,
                      };
                    });
                    break;
                  }

                  // THINKING
                  case 'THINKING_BLOCK_START': {
                    const thinkingContent = (event.data as any)?.content || { text: '' };
                    setChat(id, (prev) => ({
                      ...prev,
                      showSkeleton: false,
                      showGeneratingEffect: false,
                      history: [
                        ...prev.history,
                        {
                          type: 'THINKING',
                          text: thinkingContent.text,
                          content: thinkingContent,
                          status: 'pending',
                          actor: 'ASSISTANT',
                        } as ChatThinkingMessage,
                      ],
                    }));
                    break;
                  }
                  case 'THINKING_BLOCK_DELTA': {
                    const thinkingDelta = (event.data as any)?.thinking_delta || '';
                    setChat(id, (prev) => {
                      const newHistory = [...prev.history];
                      for (let i = newHistory.length - 1; i >= 0; i--) {
                        const msg = newHistory[i];
                        if (msg.type === 'THINKING') {
                          (msg as ChatThinkingMessage).text += thinkingDelta;
                          break;
                        }
                      }
                      return {
                        ...prev,
                        showSkeleton: false,
                        showGeneratingEffect: false,
                        history: newHistory,
                      };
                    });
                    break;
                  }
                  case 'THINKING_BLOCK_END': {
                    setChat(id, (prev) => {
                      const newHistory = [...prev.history];
                      for (let i = newHistory.length - 1; i >= 0; i--) {
                        const msg = newHistory[i];
                        if (msg.type === 'THINKING') {
                          (msg as ChatThinkingMessage).status = 'completed';
                          break;
                        }
                      }
                      return { ...prev, history: newHistory, showGeneratingEffect: true };
                    });
                    break;
                  }

                  // CODE
                  case 'CODE_BLOCK_START': {
                    const codeData = event.data as {
                      language?: string;
                      filepath?: string;
                      is_diff?: boolean;
                    };
                    setChat(id, (prev) => ({
                      ...prev,
                      showGeneratingEffect: false,
                      history: [
                        ...prev.history,
                        {
                          type: 'CODE_BLOCK_STREAMING',
                          content: {
                            language: codeData.language || '',
                            file_path: codeData.filepath,
                            code: '',
                            is_live_chat: true,
                            is_diff: codeData.is_diff || false,
                          },
                          completed: false,
                          actor: 'ASSISTANT',
                          write_mode: useChatSettingStore.getState().chatType === 'write',
                          status: 'pending',
                        } as ChatCodeBlockMessage,
                      ],
                    }));
                    break;
                  }
                  case 'CODE_BLOCK_DELTA': {
                    const codeData = event.data as { code_delta?: string };
                    const codeDelta = codeData.code_delta || '';
                    setChat(id, (prev) => {
                      const newHistory = [...prev.history];
                      const lastMsg = newHistory[newHistory.length - 1] as any;
                      if (lastMsg?.type === 'CODE_BLOCK_STREAMING') {
                        lastMsg.content.code += codeDelta;
                      }
                      return {
                        ...prev,
                        showSkeleton: false,
                        showGeneratingEffect: false,
                        history: newHistory,
                      };
                    });
                    break;
                  }
                  case 'CODE_BLOCK_END': {
                    const endData = event.data as {
                      diff: string | null;
                      added_lines: number | null;
                      removed_lines: number | null;
                    };
                    setChat(id, (prev) => {
                      const newHistory = [...prev.history];
                      const lastMsg = newHistory[newHistory.length - 1] as any;
                      if (lastMsg?.type === 'CODE_BLOCK_STREAMING') {
                        lastMsg.completed = true;
                        lastMsg.content.diff = endData.diff;
                        lastMsg.content.added_lines = endData.added_lines;
                        lastMsg.content.removed_lines = endData.removed_lines;
                      }
                      return { ...prev, history: newHistory, showGeneratingEffect: true };
                    });
                    break;
                  }
                  case 'APPLY_DIFF_RESULT': {
                    const diffResultData = event.data as {
                      status: 'completed' | 'error';
                      addedLines: number;
                      removedLines: number;
                    };
                    setChat(id, (prev) => {
                      const newHistory = [...prev.history];
                      const lastMsg = newHistory[newHistory.length - 1] as any;
                      if (lastMsg?.type === 'CODE_BLOCK_STREAMING') {
                        lastMsg.status = diffResultData.status;
                      } else if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                        lastMsg.content = {
                          ...lastMsg.content,
                          status: diffResultData.status,
                          toolResponse: {
                            ...lastMsg.content.toolResponse,
                            addedLines: diffResultData.addedLines,
                            removedLines: diffResultData.removedLines,
                          },
                        };
                      }
                      return { ...prev, history: newHistory };
                    });
                    break;
                  }

                  // TOOL CHIPS
                  case 'TOOL_CHIP_UPSERT': {
                    const baseToolProps = event.data as ToolProps & { phase: string };
                    if (baseToolProps) {
                      setChat(id, (prev) => {
                        const newHistory = [...prev.history];
                        const existingIndex = newHistory.findIndex(
                          (m) =>
                            m.type === 'TOOL_CHIP_UPSERT' &&
                            (m as ChatToolUseMessage).content.tool_use_id ===
                              baseToolProps.toolUseId
                        );

                        if (existingIndex !== -1) {
                          const existing = newHistory[existingIndex] as ChatToolUseMessage;
                          newHistory[existingIndex] = {
                            ...existing,
                            content: {
                              ...existing.content,
                              ...(baseToolProps.toolRequest && {
                                toolRequest: baseToolProps.toolRequest,
                              }),
                              ...(baseToolProps.toolResponse && {
                                toolResponse: baseToolProps.toolResponse,
                              }),
                              status: baseToolProps.toolRunStatus || existing.content.status,
                            },
                          };
                        } else {
                          newHistory.push({
                            type: 'TOOL_CHIP_UPSERT',
                            content: {
                              tool_name: baseToolProps.toolRequest?.toolName || '',
                              tool_use_id: baseToolProps.toolUseId,
                              status: baseToolProps.toolRunStatus || 'pending',
                              toolRequest: baseToolProps.toolRequest,
                            },
                          } as ChatToolUseMessage);
                        }

                        let showGeneratingEffect =
                          baseToolProps.toolRunStatus === 'completed'
                            ? true
                            : prev.showGeneratingEffect;
                        let chatStatus = prev.status;
                        if (baseToolProps.phase === 'end') {
                          switch (baseToolProps.toolRequest?.toolName) {
                            case 'ask_user_input':
                            case 'create_new_workspace':
                              chatStatus = {
                                type: 'action_required',
                                message: baseToolProps.toolRequest?.toolName,
                              };
                              showGeneratingEffect = false;
                              break;
                            default:
                              chatStatus = { type: 'in_progress' };
                          }
                        }
                        return {
                          ...prev,
                          history: newHistory,
                          showSkeleton: false,
                          showGeneratingEffect,
                          status: chatStatus,
                        };
                      });
                    }
                    break;
                  }

                  case 'TASK_PLAN_UPSERT': {
                    const taskPlanData = event.data as {
                      latest_plan_steps: Array<{
                        step_description: string;
                        is_completed: boolean;
                      }>;
                    };

                    setChat(id, (prev) => {
                      // Find the index of the last user message
                      let lastUserMessageIndex = -1;
                      for (let i = prev.history.length - 1; i >= 0; i--) {
                        if (
                          prev.history[i].type === 'TEXT_BLOCK' &&
                          (prev.history[i] as ChatUserMessage).actor === 'USER'
                        ) {
                          lastUserMessageIndex = i;
                          break;
                        }
                      }

                      // If no user message found, append to end
                      if (lastUserMessageIndex === -1) {
                        return {
                          ...prev,
                          history: [
                            ...prev.history,
                            {
                              type: 'TASK_PLAN_UPSERT',
                              content: {
                                latest_plan_steps: taskPlanData.latest_plan_steps,
                              },
                            } as ChatTaskPlanMessage,
                          ],
                          showSkeleton: false,
                        };
                      }

                      // Check if there's already a task plan immediately after the last user message
                      const nextIndex = lastUserMessageIndex + 1;
                      const hasTaskPlanAfterUser =
                        nextIndex < prev.history.length &&
                        prev.history[nextIndex].type === 'TASK_PLAN_UPSERT';

                      let newHistory;
                      if (hasTaskPlanAfterUser) {
                        // Update the existing task plan
                        newHistory = prev.history.map((msg, idx) => {
                          if (idx === nextIndex) {
                            return {
                              type: 'TASK_PLAN_UPSERT',
                              content: {
                                latest_plan_steps: taskPlanData.latest_plan_steps,
                              },
                            } as ChatTaskPlanMessage;
                          }
                          return msg;
                        });
                      } else {
                        // Insert a new task plan right after the last user message
                        newHistory = [
                          ...prev.history.slice(0, nextIndex),
                          {
                            type: 'TASK_PLAN_UPSERT',
                            content: {
                              latest_plan_steps: taskPlanData.latest_plan_steps,
                            },
                          } as ChatTaskPlanMessage,
                          ...prev.history.slice(nextIndex),
                        ];
                      }

                      return {
                        ...prev,
                        history: newHistory,
                        showSkeleton: false,
                      };
                    });
                    break;
                  }

                  case 'MALFORMED_TOOL_USE_REQUEST': {
                    setChat(id, (prev) => ({
                      ...prev,
                      showGeneratingEffect: true,
                      status: { type: 'error' },
                    }));
                    break;
                  }

                  // TERMINAL
                  case 'TERMINAL_NO_SHELL_INTEGRATION': {
                    setChat(id, (prev) => ({
                      ...prev,
                      showSkeleton: false,
                      showGeneratingEffect: false,
                      history: [
                        ...prev.history,
                        {
                          type: 'TERMINAL_NO_SHELL_INTEGRATION',
                          actor: 'ASSISTANT',
                        } as ChatTerminalNoShell,
                      ],
                    }));
                    useSettingsStore.setState({ disableShellIntegration: true });
                    break;
                  }

                  case 'TERMINAL_APPROVAL': {
                    const terminalApprovalData = event.data as {
                      tool_name: string;
                      tool_use_id: string;
                      terminal_approval_required: boolean;
                    };
                    setChat(id, (prev) => {
                      const newHistory = prev.history.map((msg) => {
                        if (msg.type === 'TOOL_CHIP_UPSERT') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalApprovalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                toolStateMetaData: {
                                  ...toolMsg.content.toolStateMetaData,
                                  terminal: {
                                    ...toolMsg.content.toolStateMetaData?.terminal,
                                    terminal_approval_required:
                                      terminalApprovalData.terminal_approval_required,
                                  },
                                },
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return {
                        ...prev,
                        history: newHistory,
                        status: { type: 'action_required', message: 'terminal_approval' },
                      };
                    });
                    break;
                  }

                  case 'EXECA_TERMINAL_PROCESS_STARTED': {
                    const terminalData = event.data as { tool_use_id: string; process_id: number };
                    logToOutput(
                      'info',
                      `EXECA_TERMINAL_PROCESS_STARTED[${id}]: tool_use_id=${terminalData.tool_use_id}, process_id=${terminalData.process_id}`
                    );
                    setChat(id, (prev) => {
                      const newHistory = prev.history.map((msg) => {
                        if (msg.type === 'TOOL_CHIP_UPSERT') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                toolStateMetaData: {
                                  ...toolMsg.content.toolStateMetaData,
                                  terminal: {
                                    ...toolMsg.content.toolStateMetaData?.terminal,
                                    process_id: terminalData.process_id,
                                    is_execa_process: true,
                                  },
                                },
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return { ...prev, history: newHistory };
                    });
                    break;
                  }

                  case 'EXECA_TERMINAL_PROCESS_OUTPUT': {
                    const terminalData = event.data as {
                      tool_use_id: string;
                      output_lines: string;
                    };
                    setChat(id, (prev) => {
                      const newHistory = prev.history.map((msg) => {
                        if (msg.type === 'TOOL_CHIP_UPSERT') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                toolStateMetaData: {
                                  ...toolMsg.content.toolStateMetaData,
                                  terminal: {
                                    ...toolMsg.content.toolStateMetaData?.terminal,
                                    terminal_output:
                                      (toolMsg.content.toolStateMetaData?.terminal
                                        ?.terminal_output || '') + terminalData.output_lines,
                                  },
                                },
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return { ...prev, history: newHistory };
                    });
                    break;
                  }

                  case 'EXECA_TERMINAL_PROCESS_COMPLETED': {
                    const terminalData = event.data as { tool_use_id: string; exit_code: number };
                    setChat(id, (prev) => {
                      const newHistory = prev.history.map((msg) => {
                        if (msg.type === 'TOOL_CHIP_UPSERT') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                toolStateMetaData: {
                                  ...toolMsg.content.toolStateMetaData,
                                  terminal: {
                                    ...toolMsg.content.toolStateMetaData?.terminal,
                                    exit_code: terminalData.exit_code,
                                  },
                                },
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return { ...prev, history: newHistory, showGeneratingEffect: true };
                    });
                    break;
                  }

                  // ERROR
                  case 'error': {
                    const errorData = event.data as {
                      payload_to_retry: unknown;
                      error_msg: string;
                      retry: boolean;
                      model?: string;
                      retry_after?: number;
                      errorType?: string;
                      current_tokens?: number;
                      max_tokens?: number;
                      detail?: string;
                      query?: string;
                      better_models?: Array<{
                        id: number;
                        display_name: string;
                        name: string;
                        input_token_limit: number;
                      }>;
                    };

                    const err = errorData.error_msg || 'Unknown error';
                    let chatStatus: ChatStatus = { type: 'error' };
                    logToOutput(
                      'info',
                      `payload data: ${JSON.stringify(errorData.payload_to_retry, null, 2)}`
                    );
                    logToOutput('error', `Streaming error[${id}]: ${err}`);

                    setChat(id, (prev) => {
                      const newHistory = [...prev.history];
                      const lastMsg = newHistory[newHistory.length - 1] as any;

                      if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                        newHistory[newHistory.length - 1] = {
                          ...lastMsg,
                          content: {
                            ...lastMsg.content,
                            status: 'error',
                            toolStateMetaData: {
                              ...lastMsg.content.toolStateMetaData,
                              terminal: {
                                ...lastMsg.content.toolStateMetaData?.terminal,
                                terminal_approval_required:
                                  lastMsg.content.tool_name === 'execute_command'
                                    ? false
                                    : lastMsg.content.toolStateMetaData?.terminal
                                        ?.terminal_approval_required,
                              },
                            },
                          },
                        };
                      }

                      if (
                        lastMsg?.type === 'CODE_BLOCK_STREAMING' &&
                        lastMsg.status === 'pending'
                      ) {
                        newHistory[newHistory.length - 1] = { ...lastMsg, status: 'error' };
                      }
                      if (lastMsg?.type === 'THINKING' && lastMsg.status === 'pending') {
                        newHistory[newHistory.length - 1] = { ...lastMsg, status: 'completed' };
                      }

                      if (errorData.errorType === 'THROTTLING_ERROR') {
                        chatStatus = { type: 'action_required', message: 'model_change' };
                        newHistory.push({
                          type: 'ERROR',
                          error_msg: err,
                          retry: errorData.retry,
                          payload_to_retry: errorData.payload_to_retry,
                          actor: 'ASSISTANT',
                          isRetryChip: false,
                          errorData: {
                            type: 'THROTTLING_ERROR',
                            model_name: errorData.model,
                            retry_after: errorData.retry_after,
                          },
                        } as ChatErrorMessage);
                      } else if (errorData.errorType === 'TOKEN_LIMIT_ERROR') {
                        chatStatus = { type: 'action_required', message: 'model_change' };
                        newHistory.push({
                          type: 'ERROR',
                          error_msg: err,
                          retry: errorData.retry,
                          payload_to_retry: errorData.payload_to_retry,
                          actor: 'ASSISTANT',
                          isRetryChip: false,
                          errorData: {
                            type: 'TOKEN_LIMIT_ERROR',
                            status: 'INPUT_TOKEN_LIMIT_EXCEEDED',
                            model: errorData.model,
                            query: errorData.query,
                            current_tokens: errorData.current_tokens,
                            max_tokens: errorData.max_tokens,
                            message: err,
                            detail: errorData.detail,
                            better_models: errorData.better_models,
                          },
                        } as ChatErrorMessage);
                      } else {
                        newHistory.push({
                          type: 'ERROR',
                          error_msg: err,
                          retry: errorData.retry,
                          payload_to_retry: errorData.payload_to_retry,
                          actor: 'ASSISTANT',
                          isRetryChip: true,
                        } as ChatErrorMessage);
                      }

                      return {
                        ...prev,
                        history: newHistory,
                        isLoading: false,
                        showSkeleton: false,
                        showGeneratingEffect: false,
                        status: chatStatus,
                      };
                    });

                    break;
                  }

                  // TASK COMPLETION
                  case 'TASK_COMPLETION': {
                    const taskCompletionData = event.data as {
                      query_id: number;
                      success: boolean;
                      summary?: string;
                    };

                    setChat(id, (prev) => {
                      const latestUserMessage = [...prev.history]
                        .reverse()
                        .find((m) => m.type === 'TEXT_BLOCK' && (m as any).actor === 'USER') as
                        | ChatUserMessage
                        | undefined;
                      let elapsedTime: number | undefined;
                      if (latestUserMessage?.lastMessageSentTime) {
                        const sentTime = new Date(latestUserMessage.lastMessageSentTime); // handles string or Date
                        elapsedTime = Date.now() - sentTime.getTime();
                      }
                      return {
                        ...prev,
                        status: { type: 'completed' },
                        showSkeleton: false,
                        showGeneratingEffect: false,
                        history: [
                          ...prev.history,
                          {
                            type: 'TASK_COMPLETION',
                            actor: 'ASSISTANT',
                            content: {
                              elapsedTime,
                              feedbackState: '',
                              queryId: taskCompletionData.query_id,
                              sessionId: prev.sessionId,
                              success: taskCompletionData.success,
                              summary: taskCompletionData.summary,
                            },
                          } as ChatCompleteMessage,
                        ],
                      };
                    });

                    logToOutput('info', `query complete ${JSON.stringify(event.data)}`);
                    break;
                  }

                  case 'end': {
                    setChat(id, (prev) => ({
                      ...prev,
                      isLoading: false,
                    }));
                    logToOutput('info', `Chat stream ended[${id}]`);
                    break;
                  }

                  default:
                    break;
                }
              }
            } catch (err) {
              logToOutput('error', `Error[${id}]: ${String(err)}`);
              showErrorMessage(`Error: ${String(err)}`);
              setChat(id, (prev) => ({
                ...prev,
                isLoading: false,
                showSkeleton: false,
                showGeneratingEffect: false,
              }));
            }
          },

          async cancelChat(chatId?: string) {
            const id = resolveChatId(chatId);
            const sessionId = get().chats[id]?.sessionId;
            apiStopChat(id, sessionId);

            setChat(id, (prev) => {
              const newHistory = [...prev.history];

              if (prev.current && prev.current.content.text) {
                newHistory.push(prev.current);
              }
              const lastMsg = newHistory[newHistory.length - 1] as any;

              if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                newHistory[newHistory.length - 1] = {
                  ...lastMsg,
                  content: {
                    ...lastMsg.content,
                    status: 'aborted',
                    toolStateMetaData: {
                      ...lastMsg.content.toolStateMetaData,
                      terminal: {
                        ...lastMsg.content.toolStateMetaData?.terminal,
                        terminal_approval_required:
                          lastMsg.content.tool_name === 'execute_command'
                            ? false
                            : lastMsg.content.toolStateMetaData?.terminal
                                ?.terminal_approval_required,
                      },
                    },
                  },
                };
              }

              if (
                (lastMsg?.type === 'CODE_BLOCK_STREAMING' || lastMsg?.type === 'THINKING') &&
                lastMsg.status === 'pending'
              ) {
                newHistory[newHistory.length - 1] = {
                  ...lastMsg,
                  status: 'aborted',
                };
              }

              logToOutput('info', `User canceled the chat stream[${id}]`);

              return {
                ...prev,
                status: { type: 'aborted' },
                history: newHistory,
                current: undefined,
                isLoading: false,
                showSkeleton: false,
                showGeneratingEffect: false,
              };
            });
          },
        };
      }
    ),
    {
      name: 'chat-storage', // Unique key for local storage persistence
      storage: persistStorage,
      // optional: prune extremely large histories / keep only N recent chats, etc.
    }
  )
);

// 🔔 Subscribe to store changes
useChatStore.subscribe((state, prevState) => {
  for (const [chatId, chat] of Object.entries(state.chats)) {
    const currentChatId = state.currentChatId;
    const viewType = useExtensionStore.getState().viewType;
    const prevChat = prevState.chats[chatId];
    if (
      chat?.status.type === 'action_required' &&
      prevChat?.status.type !== 'action_required' &&
      !(viewType === 'chat' && chatId === currentChatId)
    ) {
      onActionRequired(chatId, chat.status.message, chat.summary);
    }
  }
});

// ─────────────────────────────────────────────
// 🔁 Keep active chat in sync with global stores
// ─────────────────────────────────────────────

function syncGlobalToChat<T>(store: any, key: keyof ChatSession, selector: (state: any) => T) {
  store.subscribe((state: any) => {
    const chatStore = useChatStore.getState();
    const currentChatId = chatStore.currentChatId ?? FALLBACK_CHAT_ID;
    const value = selector(state);

    useChatStore.setState((prev) => {
      const prevChat = prev.chats[currentChatId];
      if (!prevChat) return {};
      return {
        chats: {
          ...prev.chats,
          [currentChatId]: {
            ...prevChat,
            [key]: value,
          },
        },
      };
    });
  });
}

// Usage
syncGlobalToChat(useChatSettingStore, 'chatType', (s) => s.chatType);
syncGlobalToChat(useWorkspaceStore, 'repoPath', (s) => s.activeRepo);
syncGlobalToChat(useLLMModelStore, 'activeModel', (s) => s.activeModel);

export const getActiveChatCount = (groupedChangedFiles: ChangedFilesGroup[]) => {
  const state = useChatStore.getState();
  const chats = Object.values(state.chats);
  // Collect valid sessionIds from groupedChangedFiles
  const changedSessionIds = new Set<number>(_.chain(groupedChangedFiles).map('sessionId').value());

  // Count active chats or those linked to changed session IDs
  const activeChatCount = Math.max(
    0,
    _.filter(
      chats,
      (chat) =>
        ['in_progress', 'action_required'].includes(chat.status.type) ||
        (typeof chat.sessionId === 'number' && changedSessionIds.has(chat.sessionId))
    ).length
  );
  const maxParallelChats = Number(import.meta.env.VITE_PARALLEL_CHATS_COUNT) || 3;
  const currentChatId = state.currentChatId;
  const isFallbackCurrentChat = currentChatId && currentChatId === FALLBACK_CHAT_ID;
  const currentChat = currentChatId ? state.chats[currentChatId] : undefined;
  const currentChatInProgress = currentChat
    ? ['in_progress', 'action_required'].includes(currentChat.status?.type)
    : false;

  let disableChatInput: boolean;
  if (isFallbackCurrentChat) {
    disableChatInput = activeChatCount >= maxParallelChats;
  } else if (currentChatInProgress) {
    disableChatInput = false;
  } else {
    disableChatInput = activeChatCount >= maxParallelChats;
  }
  return { activeChatCount, disableChatInput };
};

export const getFilteredChatList = () => {
  const state = useChatStore.getState();

  // 1️⃣ Filter out fallback and history chats
  const chats = _.pickBy(state.chats, (chat, chatId) => {
    return chatId !== FALLBACK_CHAT_ID && chat.status.type !== 'history';
  });

  // 2️⃣ Transform chats to list with metadata
  const chatList = _.map(chats, (chat, chatId) => {
    const latestUserMessage = _.findLast(
      chat.history,
      (m) => m.type === 'TEXT_BLOCK' && (m as any).actor === 'USER'
    ) as ChatUserMessage | undefined;

    const updatedAt = latestUserMessage?.lastMessageSentTime ?? new Date().toISOString();
    const rawUserText = _.trim(_.get(latestUserMessage, 'content.text', ''));
    const fallbackSummary = rawUserText.length > 0 ? rawUserText : 'New chat...';

    const summary = _.trim(chat.summary) || fallbackSummary;

    return {
      chatId,
      summary,
      updatedAt,
      state: chat.status,
      sessionId: chat.sessionId,
      changedFiles: chat.changedFiles,
    };
  });

  // 3️⃣ Sort chats — prioritize active ones (in_progress, action_required), then by recency
  const sorted = _.orderBy(
    chatList,
    [
      (c) => {
        // Assign priority: active chats (in_progress/action_required) = 0, others = 1
        return ['in_progress', 'action_required'].includes(c.state.type) ? 0 : 1;
      },
      (c) => Date.parse(c.updatedAt), // newer first
    ],
    ['asc', 'desc']
  );

  // 4️⃣ Keep top 3 chats only
  const topChats = sorted.slice(0, 3);

  // 5️⃣ Delete all other chats (except fallback & history)
  const allChatIds = Object.keys(chats);
  const topChatIds = new Set(topChats.map((c) => c.chatId));

  allChatIds.forEach((chatId) => {
    if (!topChatIds.has(chatId)) {
      useChatStore.getState().deleteChat(chatId);
    }
  });

  return topChats;
};
