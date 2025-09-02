import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';

import { apiChat, apiStopChat, logToOutput, showErrorMessage } from '@/commandApi';

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
  ChatTerminalNoShell,
  ChatThinkingMessage,
  ChatToolUseMessage,
  ChatType,
  ChatUserMessage,
  S3Object,
  ToolProps,
} from '@/types';
import pick from 'lodash/pick';
import { useActiveFileStore } from './activeFileStore';
import { persistGlobalStorage, persistStorage } from './lib';
import { useLLMModelStore } from './llmModelStore';
import { useSettingsStore } from './settingsStore';

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
        showSkeleton: false,
        currentEditorReference: [] as ChatReferenceItem[],
        ChatAutocompleteOptions: initialAutocompleteOptions,
        chipIndexBeingEdited: -1,
        forceUpgradeData: {} as { url: string; upgradeVersion: string },
        lastMessageSentTime: null as Date | null,
        selectedOptionIndex: -1,
        enhancingUserQuery: false,
        enhancedUserQuery: '',
        webSearchInToolUse: false,
        search_web: false,
        imageUploadProgress: 0,
        s3Objects: [] as S3Object[],
        showGeneratingEffect: false,
        setCancelButtonStatus: false,
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
              currentEditorReference: [],
              s3Objects: [],
              enhancedUserQuery: '',
              enhancingUserQuery: false,
              showGeneratingEffect: false,
              setCancelButtonStatus: false,
              showSkeleton: false,
            });
          },

          async sendChatMessage(
            message: string,
            focusItems: ChatReferenceItem[],
            attachments: S3Object[] = [],
            retryChat?: boolean,
            retry_payload?: any,
            create_new_workspace_payload?: any,
            retryReason?: string
          ) {
            logToOutput('info', `sendChatMessage: ${message}`);
            let stream;
            if (create_new_workspace_payload) {
              useChatStore.setState({ showGeneratingEffect: true });
              stream = apiChat(create_new_workspace_payload);
            } else {
              const { history } = get();
              let activeFileChatReferenceItem: ActiveFileChatReferenceItem | undefined = undefined;

              const {
                activeFileUri,
                startLine: activeStartLine,
                endLine: activeEndLine,
                disableActiveFile,
              } = useActiveFileStore.getState();
              if (!disableActiveFile && activeFileUri) {
                activeFileChatReferenceItem = {
                  type: 'file',
                  activeFileUri: activeFileUri,
                  startLine: activeStartLine,
                  endLine: activeEndLine,
                };
              }

              let lastAskUserInput: { tool_name: string; tool_use_id: string } | undefined;
              const lastMsg = history[history.length - 1];

              // Check if last message is ask user input
              if (
                lastMsg?.type === 'TOOL_CHIP_UPSERT' &&
                lastMsg.content?.tool_name === 'ask_user_input'
              ) {
                // If it is, we can use the lastAskUserInput
                lastAskUserInput = {
                  tool_name: lastMsg.content.tool_name,
                  tool_use_id: lastMsg.content.tool_use_id,
                };
              }

              // Create the user message
              const userMessage: ChatUserMessage = {
                type: 'TEXT_BLOCK',
                content: { text: message },
                focusItems: focusItems,
                attachments: attachments,
                actor: 'USER',
                lastMessageSentTime: useChatStore.getState().lastMessageSentTime,
                activeFileReference: activeFileChatReferenceItem,
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
              // Update CODE_BLOCK_STREAMING message status to 'aborted' if pending
              set((state) => {
                const newHistory = [...state.history];
                const lastMsg = newHistory[newHistory.length - 1];
                if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                  const toolMsg = lastMsg as ChatToolUseMessage;
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
                //  Abort pending CODE_BLOCK_STREAMING messages
                if (
                  (lastMsg?.type === 'CODE_BLOCK_STREAMING' || lastMsg?.type === 'THINKING') &&
                  lastMsg.status === 'pending'
                ) {
                  newHistory[newHistory.length - 1] = {
                    ...lastMsg,
                    status: 'aborted',
                  };
                }

                // Remove any error messages
                return {
                  history: newHistory.filter((msg) => msg.type !== 'ERROR'),
                };
              });

              set({
                isLoading: true,
                showSkeleton: true,
              });
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

              // Build the payload
              const payload: any = {
                search_web: useChatStore.getState().search_web,
                llm_model: useLLMModelStore.getState().activeModel?.name,
                reasoning: useLLMModelStore.getState().getActiveReasoning(),
                query: message,
                focusItems: userMessage.focusItems,
                is_tool_response: false,
                write_mode: useChatSettingStore.getState().chatType === 'write',
                is_inline: useChatSettingStore.getState().chatSource === 'inline-chat',
                attachments: attachments.map((ref) => ({ attachment_id: ref.key })),
                ...(disableActiveFile === false && { active_file_reference: activeFileReference }),
              };

              // If a tool response was stored, add it to the payload
              if (lastAskUserInput) {
                payload.is_tool_response = true;
                payload.batch_tool_responses = [
                  {
                    tool_name: lastAskUserInput.tool_name,
                    tool_use_id: lastAskUserInput.tool_use_id,
                    response: {
                      user_response: message,
                    },
                  },
                ];
              }

              if (retryChat) {
                logToOutput(
                  'info',
                  `retrying chat with payload finally: ${JSON.stringify(retry_payload)}`
                );
                retry_payload['reasoning'] = useLLMModelStore.getState().getActiveReasoning();
                if (retryReason) {
                  retry_payload['retry_reason'] = retryReason;
                }
                stream = apiChat(retry_payload);
              }
              stream = apiChat(payload);
            }

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

                  // Text Block Events
                  case 'TEXT_START': {
                    // Initialize a new current message with the desired structure
                    set((state) => ({
                      current: state.current || {
                        type: 'TEXT_BLOCK',
                        content: { text: '' },
                        actor: 'ASSISTANT',
                      },
                    }));
                    useChatStore.setState({ showGeneratingEffect: false });
                    break;
                  }

                  case 'TEXT_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
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
                    break;
                  }

                  case 'TEXT_BLOCK_END': {
                    set((state) => {
                      if (state.current) {
                        const newMessage = { ...state.current };
                        newMessage.content.text = newMessage.content.text.replace(
                          /(\r?\n\s*)+$/,
                          ''
                        ); //remove trailing new/empty lines
                        return {
                          history: [...state.history, newMessage],
                          current: undefined,
                        };
                      }
                      return state;
                    });
                    useChatStore.setState({ showGeneratingEffect: true });
                    break;
                  }

                  // Thinking Events
                  case 'THINKING_BLOCK_START': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
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
                          status: 'pending',
                          actor: 'ASSISTANT',
                        } as ChatThinkingMessage,
                      ],
                    }));
                    break;
                  }

                  case 'THINKING_BLOCK_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
                    const thinkingDelta = (event.data as any)?.thinking_delta || '';

                    set((state) => {
                      const newHistory = [...state.history];
                      for (let i = newHistory.length - 1; i >= 0; i--) {
                        const msg = newHistory[i];
                        if (msg.type === 'THINKING') {
                          (msg as ChatThinkingMessage).text += thinkingDelta;
                          break;
                        }
                      }
                      return { history: newHistory };
                    });
                    break;
                  }

                  case 'THINKING_BLOCK_END': {
                    set((state) => {
                      const newHistory = [...state.history];
                      // Find the last 'THINKING' message from the end
                      for (let i = newHistory.length - 1; i >= 0; i--) {
                        const msg = newHistory[i];
                        if (msg.type === 'THINKING') {
                          (msg as ChatThinkingMessage).status = 'completed';
                          break;
                        }
                      }
                      return { history: newHistory };
                    });
                    useChatStore.setState({ showGeneratingEffect: true });
                    break;
                  }

                  // Code Block Events
                  case 'CODE_BLOCK_START': {
                    useChatStore.setState({ showGeneratingEffect: false });
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
                    break;
                  }

                  case 'CODE_BLOCK_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
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
                    useChatStore.setState({ showGeneratingEffect: true });
                    break;
                  }

                  case 'APPLY_DIFF_RESULT': {
                    const diffResultData = event.data as {
                      status: 'completed' | 'error';
                      addedLines: number;
                      removedLines: number;
                    };
                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      if (lastMsg?.type === 'CODE_BLOCK_STREAMING') {
                        const status = diffResultData.status;
                        newHistory[newHistory.length - 1] = {
                          ...lastMsg,
                          status,
                        };
                        return { history: newHistory };
                      } else if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                        const toolMsg = lastMsg as ChatToolUseMessage;
                        const status = diffResultData.status;
                        newHistory[newHistory.length - 1] = {
                          ...toolMsg,
                          content: {
                            ...toolMsg.content,
                            status,
                            toolResponse: {
                              ...toolMsg.content.toolResponse,
                              addedLines: diffResultData.addedLines,
                              removedLines: diffResultData.removedLines,
                            },
                          },
                        };
                        return { history: newHistory };
                      }

                      return {}; // ✅ Return an empty object if no condition matches
                    });
                    break;
                  }

                  // Tool Events
                  case 'TOOL_CHIP_UPSERT': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
                    const baseToolProps = event.data as ToolProps;
                    if (baseToolProps) {
                      const newToolMsg: ChatToolUseMessage = {
                        type: 'TOOL_CHIP_UPSERT',
                        content: {
                          tool_name: baseToolProps.toolRequest?.toolName || '',
                          tool_use_id: baseToolProps.toolUseId,
                          status: baseToolProps.toolRunStatus || 'pending',
                          toolRequest: baseToolProps.toolRequest,
                        },
                      };

                      set((state) => {
                        // First check if we already have this tool message
                        const existingToolMsgIndex = state.history.findIndex(
                          (msg) =>
                            msg.type === 'TOOL_CHIP_UPSERT' &&
                            msg.content.tool_use_id === baseToolProps.toolUseId
                        );

                        if (existingToolMsgIndex !== -1) {
                          // If it exists, update it
                          const newHistory = [...state.history];
                          newHistory[existingToolMsgIndex] = {
                            ...newHistory[existingToolMsgIndex],
                            content: {
                              ...newHistory[existingToolMsgIndex].content,
                              ...(baseToolProps.toolRequest && {
                                toolRequest: baseToolProps.toolRequest,
                              }),
                              ...(baseToolProps.toolResponse && {
                                toolResponse: baseToolProps.toolResponse,
                              }),
                              status: baseToolProps.toolRunStatus,
                            },
                          };
                          if (baseToolProps.toolRunStatus === 'completed') {
                            useChatStore.setState({ showGeneratingEffect: true });
                          }
                          return { history: newHistory };
                        } else {
                          // If it doesn't exist, add it
                          return { history: [...state.history, newToolMsg] };
                        }
                      });
                    }
                    break;
                  }

                  case 'MALFORMED_TOOL_USE_REQUEST': {
                    useChatStore.setState({ showGeneratingEffect: true });
                    break;
                  }

                  // Terminal Events
                  case 'TERMINAL_NO_SHELL_INTEGRATION': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'TERMINAL_NO_SHELL_INTEGRATION',
                          actor: 'ASSISTANT',
                        } as ChatTerminalNoShell,
                      ],
                    }));
                    useSettingsStore.setState({
                      disableShellIntegration: true,
                    });
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
                        if (msg.type === 'TOOL_CHIP_UPSERT') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalApprovalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                // Correct: update terminal.terminal_approval_required here
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
                      return { history: newHistory };
                    });
                    break;
                  }

                  case 'EXECA_TERMINAL_PROCESS_STARTED': {
                    const terminalData = event.data as {
                      tool_use_id: string;
                      process_id: number;
                    };
                    logToOutput(
                      'info',
                      `EXECA_TERMINAL_PROCESS_STARTED: tool_use_id=${terminalData.tool_use_id}, process_id=${terminalData.process_id}`
                    );
                    set((state) => {
                      const newHistory = state.history.map((msg) => {
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
                      return { history: newHistory };
                    });
                    break;
                  }

                  case 'EXECA_TERMINAL_PROCESS_OUTPUT': {
                    const terminalData = event.data as {
                      tool_use_id: string;
                      output_lines: string;
                    };
                    set((state) => {
                      const newHistory = state.history.map((msg) => {
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
                      return { history: newHistory };
                    });
                    break;
                  }

                  case 'EXECA_TERMINAL_PROCESS_COMPLETED': {
                    const terminalData = event.data as {
                      tool_use_id: string;
                      exit_code: number;
                    };
                    set((state) => {
                      const newHistory = state.history.map((msg) => {
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
                      return { history: newHistory };
                    });
                    useChatStore.setState({ showGeneratingEffect: true });
                    break;
                  }

                  // Error Events
                  case 'error': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });

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

                    logToOutput(
                      'info',
                      `payload data: ${JSON.stringify(errorData.payload_to_retry, null, 2)}`
                    );
                    logToOutput('error', `Streaming error: ${err}`);

                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      // Update TOOL_CHIP_UPSERT message status to 'error' if it exists
                      if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                        const toolMsg = lastMsg as ChatToolUseMessage;
                        newHistory[newHistory.length - 1] = {
                          ...toolMsg,
                          content: {
                            ...toolMsg.content,
                            status: 'error',
                            toolStateMetaData: {
                              ...toolMsg.content.toolStateMetaData,
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

                      // Update CODE_BLOCK_STREAMING or THINKING status if pending
                      if (
                        lastMsg?.type === 'CODE_BLOCK_STREAMING' &&
                        lastMsg.status === 'pending'
                      ) {
                        newHistory[newHistory.length - 1] = {
                          ...lastMsg,
                          status: 'error',
                        };
                      }
                      if (lastMsg?.type === 'THINKING' && lastMsg.status === 'pending') {
                        newHistory[newHistory.length - 1] = {
                          ...lastMsg,
                          status: 'completed',
                        };
                      }

                      // Append the new error message
                      if (errorData.errorType === 'THROTTLING_ERROR') {
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
                        history: newHistory,
                      };
                    });

                    set({ isLoading: false, currentChatRequest: undefined });
                    break;
                  }

                  // Task Events
                  case 'TASK_COMPLETION': {
                    const taskCompletionData = event.data as {
                      query_id: number;
                      success: boolean;
                      summary?: string;
                    };
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });

                    const { history } = useChatStore.getState();
                    const latestUserMessage = [...history]
                      .reverse()
                      .find((msg) => msg.type === 'TEXT_BLOCK' && msg.actor === 'USER');

                    let elapsedTime: any;
                    if (
                      latestUserMessage &&
                      latestUserMessage.lastMessageSentTime !== null &&
                      latestUserMessage.lastMessageSentTime !== undefined
                    ) {
                      elapsedTime =
                        new Date().getTime() - latestUserMessage.lastMessageSentTime.getTime();
                    }

                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'TASK_COMPLETION',
                          actor: 'ASSISTANT',
                          content: {
                            elapsedTime,
                            feedbackState: '',
                            queryId: taskCompletionData.query_id,
                            success: taskCompletionData.success,
                            summary: taskCompletionData.summary,
                          },
                        } as ChatCompleteMessage,
                      ],
                    }));

                    logToOutput('info', `query complete ${JSON.stringify(event.data)}`);
                    break;
                  }

                  case 'end': {
                    set({ isLoading: false, currentChatRequest: undefined });
                    logToOutput('info', 'Chat stream ended');
                    break;
                  }
                  default: {
                    break;
                  }
                }
              }
            } catch (err) {
              logToOutput('error', `Error: ${String(err)}`);
              showErrorMessage(`Error: ${String(err)}`);
              set({ isLoading: false });
              useChatStore.setState({ showSkeleton: false });
              useChatStore.setState({ showGeneratingEffect: false });
            }
          },

          cancelChat() {
            apiStopChat();
            useChatStore.setState((state) => {
              const newHistory = [...state.history];
              if (state.current && state.current.content.text) {
                newHistory.push(state.current);
              }
              const lastMsg = newHistory[newHistory.length - 1];
              if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                const toolMsg = lastMsg as ChatToolUseMessage;
                newHistory[newHistory.length - 1] = {
                  ...toolMsg,
                  content: {
                    ...toolMsg.content,
                    status: 'aborted',
                  },
                };
              }
              if (lastMsg?.type === 'TOOL_CHIP_UPSERT') {
                const toolMsg = lastMsg as ChatToolUseMessage;
                newHistory[newHistory.length - 1] = {
                  ...toolMsg,
                  content: {
                    ...toolMsg.content,
                    status: 'aborted',
                    toolStateMetaData: {
                      ...toolMsg.content.toolStateMetaData,
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
              //  Abort pending CODE_BLOCK_STREAMING messages
              if (
                (lastMsg?.type === 'CODE_BLOCK_STREAMING' || lastMsg?.type === 'THINKING') &&
                lastMsg.status === 'pending'
              ) {
                newHistory[newHistory.length - 1] = {
                  ...lastMsg,
                  status: 'aborted',
                };
              }

              return {
                history: newHistory,
                current: undefined,
                currentChatRequest: undefined,
                isLoading: false,
                showSkeleton: false,
                showGeneratingEffect: false,
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
      },
      (set) => ({
        setChatType(nextChatType: ChatType) {
          set({ chatType: nextChatType });
        },
        setChatSource(nextChatSource: string) {
          set({ chatSource: nextChatSource });
        },
      })
    ),
    {
      name: 'chat-type-storage',
      storage: persistGlobalStorage,
      partialize: (state) => pick(state, ['chatType', 'chatSource', 'activeModel']),
    }
  )
);
