import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';

import { apiChat, apiStopChat, logToOutput, showErrorMessage } from '@/commandApi';

import {
  ActiveFileChatReferenceItem,
  AutocompleteOption,
  BaseToolProps,
  ChatAssistantMessage,
  ChatCodeBlockMessage,
  ChatCompleteMessage,
  ChatErrorMessage,
  ChatMessage,
  ChatMetaData,
  ChatReferenceItem,
  ChatReplaceBlockMessage,
  ChatTerminalNoShell,
  ChatThinkingMessage,
  ChatToolUseMessage,
  ChatType,
  ChatUserMessage,
  LLMModels,
  S3Object,
} from '@/types';
import pick from 'lodash/pick';
import { persistGlobalStorage, persistStorage } from './lib';
import { useSettingsStore } from './settingsStore';
import { useIndexingStore } from './indexingDataStore';
import { useActiveFileStore } from './activeFileStore';

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
        lastToolUseResponse: undefined as { tool_use_id: string; tool_name: string } | undefined,
        forceUpgradeData: {} as { url: string; upgradeVersion: string },
        lastMessageSentTime: null as Date | null,
        selectedOptionIndex: -1,
        enhancingUserQuery: false,
        enhancedUserQuery: '',
        llmModels: [] as LLMModels[],
        webSearchInToolUse: false,
        activeModel: '',
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
              lastToolUseResponse: undefined,
              s3Objects: [],
              enhancedUserQuery: '',
              enhancingUserQuery: false,
              showGeneratingEffect: false,
              setCancelButtonStatus: false,
            });
          },

          async sendChatMessage(
            message: string,
            editorReferences: ChatReferenceItem[],
            chunkCallback: (data: { name: string; data: any }) => void,
            s3References: S3Object[] = [],
            retryChat?: boolean,
            retry_payload?: any,
            create_new_workspace_payload?: any
          ) {
            logToOutput('info', `sendChatMessage: ${message}`);
            let stream;
            if (create_new_workspace_payload) {
              useChatStore.setState({ showGeneratingEffect: true });
              stream = apiChat(create_new_workspace_payload);
            } else {
              const { history, lastToolUseResponse } = get();
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

              // Create the user message
              const userMessage: ChatUserMessage = {
                type: 'TEXT_BLOCK',
                content: { text: message },
                referenceList: editorReferences,
                s3References: s3References,
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
                if (lastMsg?.type === 'CODE_BLOCK_STREAMING' && lastMsg.status === 'pending') {
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
                llm_model: useChatSettingStore.getState().activeModel,
                query: message,
                urls: userMessage.referenceList.filter((item) => item.url),
                is_tool_response: false,
                relevant_chunks: [] as string[],
                write_mode: useChatSettingStore.getState().chatType === 'write',
                referenceList: userMessage.referenceList.filter((item) => !item.url),
                is_inline: useChatSettingStore.getState().chatSource === 'inline-chat',
                attachments: s3References.map((ref) => ({ attachment_id: ref.key })),
                ...(disableActiveFile === false && { active_file_reference: activeFileReference }),
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
                    useChatStore.setState({ showGeneratingEffect: false });
                    chunkCallback({ name: 'TEXT_START', data: event.data });
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

                    chunkCallback({ name: 'TEXT_DELTA', data: event.data });
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
                    chunkCallback({ name: 'TEXT_BLOCK_END', data: event.data });
                    break;
                  }

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

                    chunkCallback({
                      name: 'THINKING_BLOCK_DELTA',
                      data: event.data,
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
                          (msg as ChatThinkingMessage).completed = true;
                          break;
                        }
                      }
                      return { history: newHistory };
                    });
                    useChatStore.setState({ showGeneratingEffect: true });
                    break;
                  }

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

                    chunkCallback({
                      name: 'CODE_BLOCK_START',
                      data: event.data,
                    });
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
                    useChatStore.setState({ showGeneratingEffect: true });

                    chunkCallback({ name: 'CODE_BLOCK_END', data: event.data });
                    break;
                  }

                  case 'REPLACE_IN_FILE_BLOCK_START': {
                    const replaceInFileData = event.data as {
                      filepath?: string;
                    };

                    const replaceInFileMsg: ChatReplaceBlockMessage = {
                      type: 'REPLACE_IN_FILE_BLOCK_STREAMING',
                      content: {
                        filepath: replaceInFileData.filepath,
                        diff: '',
                        is_live_chat: true,
                      },
                      completed: false,
                      actor: 'ASSISTANT',
                      write_mode: useChatSettingStore.getState().chatType === 'write',
                      status: 'pending',
                    };

                    set((state) => ({
                      history: [...state.history, replaceInFileMsg],
                    }));

                    break;
                  }

                  case 'REPLACE_IN_FILE_BLOCK_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    const replaceInFileData = event.data as { replace_delta?: string };
                    const replaceDelta = replaceInFileData.replace_delta || '';
                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      if (lastMsg?.type === 'REPLACE_IN_FILE_BLOCK_STREAMING') {
                        lastMsg.content.diff += replaceDelta; // Update the code inside content
                      }

                      return { history: newHistory };
                    });
                    break;
                  }

                  case 'REPLACE_IN_FILE_BLOCK_END': {
                    const replaceInFileData = event.data as {
                      diff: string;
                      filepath: string | null;
                    };
                    logToOutput('info', `code end data ${replaceInFileData.diff}`);

                    set((state) => {
                      const newHistory = [...state.history];
                      const lastMsg = newHistory[newHistory.length - 1];

                      if (lastMsg?.type === 'REPLACE_IN_FILE_BLOCK_STREAMING') {
                        // ✅ Update diff info
                        lastMsg.content.diff = replaceInFileData.diff;
                        lastMsg.completed = true;
                      }

                      return { history: newHistory };
                    });

                    break;
                  }

                  case 'QUERY_COMPLETE': {
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
                          type: 'QUERY_COMPLETE',
                          actor: 'ASSISTANT',
                          content: {
                            elapsedTime,
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

                    chunkCallback({ name: 'TERMINAL_NO_SHELL_INTEGRATION', data: event.data });
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
                      } else if (lastMsg?.type === 'TOOL_USE_REQUEST') {
                        const toolMsg = lastMsg as ChatToolUseMessage;
                        newHistory[newHistory.length - 1] = {
                          ...toolMsg,
                          content: {
                            ...toolMsg.content,
                            diff: {
                              addedLines: diffResultData.addedLines,
                              removedLines: diffResultData.removedLines,
                            },
                          },
                        };
                        return { history: newHistory };
                      }

                      return {}; // ✅ Return an empty object if no condition matches
                    });

                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }

                  case 'TOOL_USE_REQUEST_START': {
                    useChatStore.setState({ showGeneratingEffect: false });
                    const toolData = event.data as {
                      tool_name: string;
                      tool_use_id: string;
                      write_mode: boolean;
                    };

                    // For normal tools, create a tool use message.
                    const newToolMsg: ChatToolUseMessage = {
                      type: 'TOOL_USE_REQUEST',
                      content: {
                        tool_name: toolData.tool_name || '',
                        tool_use_id: toolData.tool_use_id || '',
                        input_params_json: '',
                        result_json: '',
                        status: 'pending',
                        write_mode: toolData.write_mode,
                      },
                    };
                    set((state) => ({
                      history: [...state.history, newToolMsg],
                    }));

                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }
                  case 'TOOL_USE_REQUEST_DELTA': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
                    const { delta, tool_use_id, tool_name } = event.data as {
                      tool_name: string;
                      delta: string;
                      tool_use_id: string;
                    };
                    switch (tool_name) {
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
                                // Correct: update terminal.terminal_approval_required here
                                terminal: {
                                  ...toolMsg.content.terminal,
                                  terminal_approval_required:
                                    terminalApprovalData.terminal_approval_required,
                                },
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

                  case 'TOOL_CHIP_UPSERT': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });
                    const baseToolProps = event.data as BaseToolProps;
                    if (baseToolProps) {
                      const newToolMsg: ChatToolUseMessage = {
                        type: 'TOOL_CHIP_UPSERT',
                        content: {
                          tool_name: baseToolProps.toolRequest?.toolName || '',
                          tool_use_id: baseToolProps.toolUseId,
                          input_params_json: '',
                          result_json: '',
                          status: 'pending',
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
                              toolRequest: baseToolProps.toolRequest,
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
                          return {
                            history: [...state.history, newToolMsg],
                          };
                        }
                      });
                    }
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
                        if (msg.type === 'TOOL_USE_REQUEST') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                terminal: {
                                  ...toolMsg.content.terminal,
                                  process_id: terminalData.process_id,
                                  is_execa_process: true,
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
                        if (msg.type === 'TOOL_USE_REQUEST') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                terminal: {
                                  ...toolMsg.content.terminal,
                                  terminal_output:
                                    (toolMsg.content.terminal?.terminal_output || '') +
                                    terminalData.output_lines,
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
                        if (msg.type === 'TOOL_USE_REQUEST') {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === terminalData.tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                terminal: {
                                  ...toolMsg.content.terminal,
                                  exit_code: terminalData.exit_code,
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
                    if (
                      toolResultData.status !== 'aborted' &&
                      toolResultData.tool_name !== 'ask_user_input'
                    ) {
                      useChatStore.setState({ showGeneratingEffect: true });
                    }

                    chunkCallback({ name: event.name, data: event.data });
                    break;
                  }
                  case 'STREAM_ERROR': {
                    const data = event.data || {};
                    // Throttling detection (expanded)
                    if (
                      (data as any).error === 'throttled' ||
                      (data as any).status === 'THROTTLED' ||
                      (data as any).isThrottling === true ||
                      (data as any).name === 'ThrottlingException'
                    ) {
                      set((state) => ({
                        history: [
                          ...state.history,
                          {
                            type: 'ERROR',
                            error_msg:
                              (data as any).message ||
                              (data as any).originalMessage ||
                              'You are being rate limited.',
                            retry: true,
                            payload_to_retry: {},
                            actor: 'ASSISTANT',
                            is_throttling: true,
                            content: {
                              // Only set retry_after_seconds if provided by backend
                              ...(typeof (data as any).retry_after_seconds === 'number' && {
                                retry_after_seconds: (data as any).retry_after_seconds,
                              }),
                              ...(typeof (data as any).retry_after === 'number' && {
                                retry_after_seconds: (data as any).retry_after,
                              }),
                            },
                          },
                        ],
                      }));
                      set({ isLoading: false, currentChatRequest: undefined });
                      break;
                    }
                    // Fallback: handle as normal error
                    set((state) => ({
                      history: [
                        ...state.history,
                        {
                          type: 'ERROR',
                          error_msg: (data as any).message || 'An error occurred.',
                          retry: true,
                          payload_to_retry: {},
                          actor: 'ASSISTANT',
                        },
                      ],
                    }));
                    set({ isLoading: false, currentChatRequest: undefined });
                    break;
                  }
                  case 'error': {
                    useChatStore.setState({ showSkeleton: false });
                    useChatStore.setState({ showGeneratingEffect: false });

                    const errorData = event.data as {
                      payload_to_retry: unknown;
                      error_msg: string;
                      retry: boolean;
                      is_throttling?: boolean;
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

                      // Update TOOL_USE_REQUEST
                      if (lastMsg?.type === 'TOOL_USE_REQUEST') {
                        const toolMsg = lastMsg as ChatToolUseMessage;
                        newHistory[newHistory.length - 1] = {
                          ...toolMsg,
                          content: {
                            ...toolMsg.content,
                            status: 'error',
                            terminal: {
                              ...toolMsg.content.terminal,
                              terminal_approval_required:
                                toolMsg.content.tool_name === 'execute_command'
                                  ? false
                                  : toolMsg.content.terminal?.terminal_approval_required,
                            },
                          },
                        };
                      }

                      // Update CODE_BLOCK_STREAMING
                      if (
                        lastMsg?.type === 'CODE_BLOCK_STREAMING' &&
                        lastMsg.status === 'pending'
                      ) {
                        newHistory[newHistory.length - 1] = {
                          ...lastMsg,
                          status: 'error',
                        };
                      }

                      // Append the new error message
                      newHistory.push({
                        type: 'ERROR',
                        error_msg: err,
                        retry: errorData.retry,
                        payload_to_retry: errorData.payload_to_retry,
                        actor: 'ASSISTANT',
                        is_throttling: errorData.is_throttling,
                      } as ChatErrorMessage);

                      return {
                        history: newHistory,
                      };
                    });

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
              if (lastMsg?.type === 'TOOL_USE_REQUEST') {
                const toolMsg = lastMsg as ChatToolUseMessage;
                newHistory[newHistory.length - 1] = {
                  ...toolMsg,
                  content: {
                    ...toolMsg.content,
                    status: 'aborted',
                    terminal: {
                      ...toolMsg.content.terminal,
                      terminal_approval_required:
                        toolMsg.content.tool_name === 'execute_command'
                          ? false
                          : toolMsg.content.terminal?.terminal_approval_required,
                    },
                  },
                };
              }

              //  Abort pending CODE_BLOCK_STREAMING messages
              if (lastMsg?.type === 'CODE_BLOCK_STREAMING' && lastMsg.status === 'pending') {
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
        activeModel: '',
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
