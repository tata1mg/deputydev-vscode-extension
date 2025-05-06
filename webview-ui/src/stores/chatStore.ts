// file: webview-ui/src/stores/chatStore.ts
import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';

import { apiChat, apiStopChat, logToOutput, showErrorMessage } from '@/commandApi';

import { persistGlobalStorage, persistStorage } from './lib';
import pick from 'lodash/pick';
import {
  AutocompleteOption,
  ChatReferenceItem,
  ChatType,
  ChatAssistantMessage,
  ChatUserMessage,
  ChatToolUseMessage,
  ChatThinkingMessage,
  ChatCodeBlockMessage,
  ChatMessage,
  ChatErrorMessage,
  ChatCompleteMessage,
  ProgressBarData,
  ChatTerminalNoShell,
  ChatMetaData,
  LLMModels,
} from '@/types';

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

export const useChatStore = create(
  persist(
    combine(
      {
        history: [] as ChatMessage[],
        current: undefined as ChatAssistantMessage | undefined,
        userInput: '',
        currentChatRequest: undefined as any,
        isLoading: false,
        showSessionsBox: true,
        showAllSessions: false,
        showSkeleton: false,
        currentEditorReference: [] as ChatReferenceItem[],
        ChatAutocompleteOptions: initialAutocompleteOptions,
        chipIndexBeingEdited: -1,
        lastToolUseResponse: undefined as { tool_use_id: string; tool_name: string } | undefined,
        progressBars: [] as ProgressBarData[], // Todo: move these to separate store(s)
        forceUpgradeData: {} as { url: string; upgradeVersion: string },
        lastMessageSentTime: null as Date | null,
        selectedOptionIndex: -1,
        enhancingUserQuery: false,
        enhancedUserQuery: '',
        llmModels: [] as LLMModels[],
        webSearchInToolUse: false,
        activeModel: '',
        search_web: false,
      },
      (set, get) => {
        // Helper to generate an incremental message ID.

        return {
          async clearChat() {
            set({
              history: [],
              current: undefined,
              currentChatRequest: undefined,
              isLoading: false,
              showSessionsBox: true,
              showAllSessions: false,
              currentEditorReference: [],
              lastToolUseResponse: undefined,
              enhancedUserQuery: '',
              enhancingUserQuery: false,
            });
          },

          async sendChatMessage(
            message: string,
            editorReferences: ChatReferenceItem[],
            chunkCallback: (data: { name: string; data: any }) => void,
            retryChat?: boolean,
            retry_payload?: any,
            create_new_workspace_payload?: any
          ) {
            logToOutput('info', `sendChatMessage: ${message}`);
            let stream;
            if (create_new_workspace_payload) {
              stream = apiChat(create_new_workspace_payload);
            } else {
              const { history, lastToolUseResponse } = get();

              // Create the user message
              const userMessage: ChatUserMessage = {
                type: 'TEXT_BLOCK',
                content: { text: message },
                referenceList: editorReferences,
                actor: 'USER',
              };

              if (!retryChat) {
                set({
                  history: [...history, userMessage],
                  current: {
                    type: 'TEXT_BLOCK',
                    content: { text: '' },
                    actor: 'ASSISTANT',
                  },
                });
              }

              // Remove any error messages from history
              set((state) => ({
                history: state.history.filter((msg) => msg.type !== 'ERROR'),
              }));

              set({
                isLoading: true,
                showSkeleton: true,
              });

              // Build the payload
              const payload: any = {
                search_web: useChatStore.getState().search_web,
                llm_model: useChatSettingStore.getState().activeModel,
                query: message,
                urls: userMessage.referenceList.filter((item) => item.url),
                is_tool_response: false,
                relevant_chunks: [] as string[],
                write_mode: useChatSettingStore.getState().chatType === 'write',
                referenceList: userMessage.referenceList.filter((item) => !item.url),
                is_inline: useChatSettingStore.getState().chatSource === 'inline-chat',
              };

              // If a tool response was stored, add it to the payload
              if (lastToolUseResponse) {
                payload.is_tool_response = true;
                payload.tool_use_response = {
                  tool_name: lastToolUseResponse.tool_name,
                  tool_use_id: lastToolUseResponse.tool_use_id,
                  response: {
                    user_response: message,
                  },
                };
                // Clear it so it doesn't affect subsequent messages.
                set({ lastToolUseResponse: undefined });
              }

              if (retryChat) {
                logToOutput(
                  'info',
                  `retrying chat with payload finally: ${JSON.stringify(retry_payload)}`
                );
                stream = apiChat(retry_payload);
              } else {
                stream = apiChat(payload);
              }
            }

            // console.log("stream received in FE : ", stream);

            try {
              for await (const event of stream) {
                switch (event.name) {
                  case 'RESPONSE_METADATA': {
                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'RESPONSE_METADATA',
                          content: event.data,
                        } as ChatMetaData,
                      ],
                    }));

                    logToOutput('info', `query complete ${JSON.stringify(event.data)}`);
                    break;
                  }
                  case 'TEXT_START': {
                    // Initialize a new current message with the desired structure
                    set((state) => ({
                      current: state.current || {
                        type: 'TEXT_BLOCK',
                        content: { text: '' },
                        actor: 'ASSISTANT',
                      },
                    }));
                    chunkCallback({ name: 'TEXT_START', data: event.data });
                    break;
                  }

                  case 'TEXT_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    const textChunk = (event.data as any)?.text || '';

                    set((state) => ({
                      current: state.current
                        ? {
                            ...state.current,
                            content: {
                              text: state.current.content.text + textChunk,
                            },
                          }
                        : state.current,
                    }));

                    chunkCallback({ name: 'TEXT_DELTA', data: event.data });
                    break;
                  }

                  case 'TEXT_BLOCK_END': {
                    set((state) => {
                      if (state.current) {
                        const newMessage = { ...state.current };
                        return {
                          history: [...state.history, newMessage],
                          current: undefined,
                        };
                      }
                      return state;
                    });

                    chunkCallback({ name: 'TEXT_BLOCK_END', data: event.data });
                    break;
                  }

                  case 'THINKING_BLOCK_START': {
                    const thinkingContent = (event.data as any)?.content || {
                      text: '',
                    };

                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'THINKING',
                          text: thinkingContent.text,
                          content: thinkingContent,
                          completed: false,
                          actor: 'ASSISTANT',
                        } as ChatThinkingMessage,
                      ],
                    }));

                    chunkCallback({
                      name: 'THINKING_BLOCK_START',
                      data: event.data,
                    });
                    break;
                  }

                  case 'THINKING_BLOCK_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    const thinkingDelta = (event.data as any)?.thinking_delta || '';

                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      if (lastMsg?.type === 'THINKING') {
                        lastMsg.text += thinkingDelta;
                        lastMsg.text += thinkingDelta; // Ensure content.text is updated as well
                      }

                      return { history: newHistory };
                    });

                    chunkCallback({
                      name: 'THINKING_BLOCK_DELTA',
                      data: event.data,
                    });
                    break;
                  }

                  case 'THINKING_BLOCK_END': {
                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      if (lastMsg?.type === 'THINKING') {
                        lastMsg.completed = true;
                      }

                      return { history: newHistory };
                    });

                    chunkCallback({
                      name: 'THINKING_BLOCK_END',
                      data: event.data,
                    });
                    break;
                  }

                  case 'CODE_BLOCK_START': {
                    const codeData = event.data as {
                      language?: string;
                      filepath?: string;
                      is_diff?: boolean;
                    };

                    const codeBlockMsg: ChatCodeBlockMessage = {
                      type: 'CODE_BLOCK_STREAMING',
                      content: {
                        language: codeData.language || '',
                        file_path: codeData.filepath,
                        code: '',
                        is_live_chat: true,
                        is_diff: codeData.is_diff || false, // ✅ Save is_diff here
                      },
                      completed: false,
                      actor: 'ASSISTANT',
                      write_mode: useChatSettingStore.getState().chatType === 'write',
                      status: 'pending',
                    };

                    set((state) => ({
                      history: [...state.history, codeBlockMsg],
                    }));

                    chunkCallback({
                      name: 'CODE_BLOCK_START',
                      data: event.data,
                    });
                    break;
                  }

                  case 'CODE_BLOCK_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    const codeData = event.data as { code_delta?: string };
                    const codeDelta = codeData.code_delta || '';

                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      if (lastMsg?.type === 'CODE_BLOCK_STREAMING') {
                        lastMsg.content.code += codeDelta; // Update the code inside content
                      }

                      return { history: newHistory };
                    });

                    chunkCallback({
                      name: 'CODE_BLOCK_DELTA',
                      data: event.data,
                    });
                    break;
                  }

                  case 'CODE_BLOCK_END': {
                    const endData = event.data as {
                      diff: string | null;
                      added_lines: number | null;
                      removed_lines: number | null;
                    };
                    logToOutput('info', `code end data ${endData.diff}`);

                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      if (lastMsg?.type === 'CODE_BLOCK_STREAMING') {
                        lastMsg.completed = true;

                        // ✅ Update diff info
                        lastMsg.content.diff = endData.diff;
                        lastMsg.content.added_lines = endData.added_lines;
                        lastMsg.content.removed_lines = endData.removed_lines;
                      }

                      return { history: newHistory };
                    });

                    chunkCallback({ name: 'CODE_BLOCK_END', data: event.data });
                    break;
                  }

                  case 'QUERY_COMPLETE': {
                    useChatStore.setState({ showSkeleton: false });
                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'QUERY_COMPLETE',
                          actor: 'ASSISTANT',
                          content: {
                            elapsedTime:
                              new Date().getTime() - (state.lastMessageSentTime?.getTime() || 0),
                            feedbackState: '',
                          },
                        } as ChatCompleteMessage,
                      ],
                    }));

                    logToOutput('info', `query complete ${JSON.stringify(event.data)}`);

                    chunkCallback({ name: 'QUERY_COMPLETE', data: event.data });
                    break;
                  }

                  case 'TERMINAL_NO_SHELL_INTEGRATION': {
                    useChatStore.setState({ showSkeleton: false });
                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'TERMINAL_NO_SHELL_INTEGRATION',
                          actor: 'ASSISTANT',
                        } as ChatTerminalNoShell,
                      ],
                    }));

                    chunkCallback({ name: 'TERMINAL_NO_SHELL_INTEGRATION', data: event.data });
                    break;
                  }

                  case 'APPLY_DIFF_RESULT': {
                    const diffResultData = event.data as 'completed' | 'error';
                    set((state) => {
                      const newHistory = [...state.history]; // Copy the history array
                      const lastMsg = newHistory[newHistory.length - 1]; // Get the last message
                      logToOutput('info', `ui got the applied diff}`);
                      // log modified files
                      if (lastMsg?.type === 'CODE_BLOCK_STREAMING') {
                        // Determine the correct status type
                        logToOutput('info', `ui got the applied dif part 2} ${lastMsg}`);
                        const status = diffResultData;
                        logToOutput('info', `status at the ui  ${status}`);
                        // Update only the last CODE_BLOCK message
                        newHistory[newHistory.length - 1] = {
                          ...lastMsg,
                          status, // ✅ Update status only for the last CODE_BLOCK
                        };

                        logToOutput('info', `status ${status}`);
                      }

                      return { history: newHistory }; // Update state
                    });

                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }

                  case 'TOOL_USE_REQUEST_START': {
                    const toolData = event.data as {
                      tool_name?: string;
                      tool_use_id?: string;
                    };
                    if (toolData.tool_name === 'ask_user_input') {
                      // For ask_user_input, create an assistant message.
                      set({
                        current: {
                          type: 'TEXT_BLOCK',
                          content: { text: '' },
                          actor: 'ASSISTANT',
                        },
                      });
                    } else {
                      // For normal tools, create a tool use message.
                      const newToolMsg: ChatToolUseMessage = {
                        type: 'TOOL_USE_REQUEST',
                        content: {
                          tool_name: toolData.tool_name || '',
                          tool_use_id: toolData.tool_use_id || '',
                          input_params_json: '',
                          result_json: '',
                          status: 'pending',
                        },
                      };
                      set((state) => ({
                        history: [...state.history, newToolMsg],
                      }));
                    }
                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }
                  case 'TOOL_USE_REQUEST_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    const { delta, tool_use_id, tool_name } = event.data as {
                      tool_name: string;
                      delta: string;
                      tool_use_id: string;
                    };
                    switch (tool_name) {
                      case 'ask_user_input':
                        set((state) => ({
                          current: state.current
                            ? {
                                ...state.current,
                                content: {
                                  text: (state.current.content.text + delta)
                                    .replace(/^\{"prompt":\s*"/, '') // Remove `{"prompt": "`
                                    .replace(/"}$/, ''), // Remove trailing `"}`
                                },
                              }
                            : state.current,
                        }));
                        break;

                      default:
                        set((state) => {
                          const newHistory = state.history.map((msg) => {
                            if (msg.type === 'TOOL_USE_REQUEST') {
                              const toolMsg = msg as ChatToolUseMessage;
                              if (toolMsg.content.tool_use_id === tool_use_id) {
                                return {
                                  ...toolMsg,
                                  content: {
                                    ...toolMsg.content,
                                    input_params_json: toolMsg.content.input_params_json + delta,
                                  },
                                };
                              }
                            }
                            return msg;
                          });
                          return { history: newHistory };
                        });
                        break;
                    }

                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }

                  case 'TOOL_USE_REQUEST_END': {
                    const { tool_name, tool_use_id } = event.data as {
                      tool_name: string;
                      tool_use_id: string;
                    };

                    switch (tool_name) {
                      case 'ask_user_input':
                        // Finalize the assistant message.
                        set((state) => {
                          if (!state.current) return state;
                          const finalText = state.current.content?.text;
                          return {
                            history: [...state.history, { ...state.current, text: finalText }],
                            current: undefined,
                            lastToolUseResponse: { tool_use_id, tool_name },
                          };
                        });
                        break;

                      default:
                        set((state) => {
                          const newHistory = state.history.map((msg) => {
                            if (msg.type === 'TOOL_USE_REQUEST') {
                              const toolMsg = msg as ChatToolUseMessage;
                              if (toolMsg.content.tool_use_id === tool_use_id) {
                                return {
                                  ...toolMsg,
                                  content: {
                                    ...toolMsg.content,
                                    status: 'pending' as const,
                                  },
                                };
                              }
                            }
                            return msg;
                          });
                          return { history: newHistory };
                        });
                        break;
                    }

                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }

                  case 'TERMINAL_APPROVAL': {
                    const terminalApprovalData = event.data as {
                      tool_name: string;
                      tool_use_id: string;
                      terminal_approval_required: boolean;
                    };
                    set((state) => {
                      const newHistory = state.history.map((msg) => {
                        if (msg.type === 'TOOL_USE_REQUEST') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalApprovalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                terminal_approval_required:
                                  terminalApprovalData.terminal_approval_required,
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return { history: newHistory };
                    });
                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }

                  case 'TOOL_USE_RESULT': {
                    const toolResultData = event.data as {
                      tool_name: string;
                      tool_use_id: string;
                      result_json: string;
                      status: 'completed' | 'error' | 'aborted';
                    };
                    set((state) => {
                      const newHistory = state.history.map((msg) => {
                        if (msg.type === 'TOOL_USE_REQUEST') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === toolResultData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                result_json: toolResultData.result_json, // ✅ Now correctly inside content
                                status: toolResultData.status, // ✅ Now correctly inside content
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return { history: newHistory };
                    });

                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }
                  case 'error': {
                    //       chunkCallback({ name: "error", data: { payload_to_retry: payload, error_msg: String(error) ,  retry: true}  });
                    useChatStore.setState({ showSkeleton: false });
                    const errorData = event.data as {
                      payload_to_retry: unknown;
                      error_msg: string;
                      retry: boolean;
                    };
                    const err = errorData.error_msg || 'Unknown error';
                    logToOutput(
                      'info',
                      `payload data: ${JSON.stringify(errorData.payload_to_retry, null, 2)}`
                    );
                    logToOutput('error', `Streaming error: ${err}`);
                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'ERROR',
                          error_msg: err,
                          retry: errorData.retry,
                          payload_to_retry: errorData.payload_to_retry,
                          actor: 'ASSISTANT',
                        } as ChatErrorMessage,
                      ],
                    }));
                    set({ isLoading: false, currentChatRequest: undefined });
                    chunkCallback({ name: 'error', data: { error: err } });
                    break;
                  }
                  case 'end': {
                    set({ isLoading: false, currentChatRequest: undefined });
                    logToOutput('info', 'Chat stream ended');
                    // await apiSaveSession({
                    //   session: get().history.map((msg) => ({
                    //     role: msg.type,
                    //     content:
                    //       msg.type === 'user'
                    //         ? msg.text
                    //         : msg.type === 'assistant'
                    //         ? msg.text
                    //         : (msg as ChatToolUseMessage).input_params_json || '',
                    //   })),
                    // });
                    chunkCallback({ name: 'end', data: {} });
                    break;
                  }
                  default: {
                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }
                }
              }
            } catch (err) {
              logToOutput('error', `Error: ${String(err)}`);
              showErrorMessage(`Error: ${String(err)}`);
              set({ isLoading: false });
              useChatStore.setState({ showSkeleton: false });
            }
          },

          cancelChat() {
            apiStopChat();
            useChatStore.setState((state) => {
              const newHistory = [...state.history];
              if (state.current) {
                newHistory.push(state.current);
              }
              const lastMsg = newHistory[newHistory.length - 1];
              if (lastMsg?.type === 'TOOL_USE_REQUEST') {
                const toolMsg = lastMsg as ChatToolUseMessage;
                newHistory[newHistory.length - 1] = {
                  ...toolMsg,
                  content: {
                    ...toolMsg.content,
                    status: 'aborted' as const,
                    terminal_approval_required:
                      toolMsg.content.tool_name === 'execute_command'
                        ? false
                        : toolMsg.content.terminal_approval_required,
                  },
                };
              }

              return {
                history: newHistory,
                current: undefined,
                currentChatRequest: undefined,
                isLoading: false,
                showSkeleton: false,
              };
            });

            logToOutput('info', 'User canceled the chat stream');
          },
        };
      }
    ),
    {
      name: 'chat-storage', // Unique key for local storage persistence
      storage: persistStorage, // Uses the same storage as in `useChatSessionStore`
    }
  )
);

// =============================================================================
// CHAT SETTING STORE
// =============================================================================

export const useChatSettingStore = create(
  persist(
    combine(
      {
        chatType: 'ask' as ChatType,
        chatSource: 'chat' as string,
        activeModel: '',
      },
      (set) => ({
        setChatType(nextChatType: ChatType) {
          set({ chatType: nextChatType });
        },
        setChatSource(nextChatSource: string) {
          set({ chatSource: nextChatSource });
        },
        setActiveModel(activeModel: string) {
          set({ activeModel: activeModel });
        },
      })
    ),
    {
      name: 'chat-type-storage',
      storage: persistGlobalStorage,
      partialize: (state) => pick(state, ['chatType', 'chatSource']),
    }
  )
);
