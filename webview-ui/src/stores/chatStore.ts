// file: webview-ui/src/stores/chatStore.ts
import { create } from "zustand";
import { combine, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

import {
  apiChat,
  apiClearChat,
  apiSaveSession,
  cancelGenerateCode,
  logToOutput,
  showErrorMessage,
  showInfoMessage,
  writeFile,
} from "@/commandApi";

import { persistStorage } from "./lib";
import pick from "lodash/pick";
import { AutocompleteOption, ChatReferenceItem } from "@/types";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ChatType = "ask" | "write";

export interface ChatReferenceFileItem {
  id: string;
  type: "file";
  name: string;
  fsPath: string;
}

export interface ChatReferenceDirectoryItem {
  id: string;
  type: "directory";
  name: string;
  fsPath: string;
}

export interface ChatReferenceFunctionItem {
  id: string;
  type: "function";
  name: string;
  fsPath: string;
}
// export interface ChatUserMessage {
//   id: string; // initially empty; updated via RESPONSE_METADATA
//   type: 'user';
//   text: string;
//   referenceList: ChatReferenceItem[];
// }

export interface ChatAssistantMessage {
  type: "TEXT_BLOCK"; // Updated to match the new message format
  content: {
    text: string;
  };
  usage?: string;
  actor: "ASSISTANT";
}

export interface ChatUserMessage {
  type: "TEXT_BLOCK";
  content: {
    text: string;
  };
  referenceList: ChatReferenceItem[];
  actor: "USER";
}

// New type for tool use messages.
export interface ChatToolUseMessage {
  type: "TOOL_USE_REQUEST_BLOCK";
  content: {
    tool_name: string;
    tool_use_id: string;
    input_params_json: string;
    result_json: string;
    status: "in-progress" | "completed" | "error";
  };
}

export interface ThinkingMessage {
  type: "THINKING";
  text: string;
  completed: boolean;
  actor?: "ASSISTANT";
}

export interface ChatCodeBlockMessage {
  type: "CODE_BLOCK";
  content: {
    language: string;
    file_path?: string;
    code: string;
    is_diff?: boolean;
    diff?: string | null;
    added_lines?: number | null;
    removed_lines?: number | null;
  };
  completed: boolean;
  actor: "ASSISTANT";
}

export type ChatMessage =
  | ChatUserMessage
  | ChatAssistantMessage
  | ChatToolUseMessage
  | ThinkingMessage
  | ChatCodeBlockMessage;

export interface ChatReferenceSnippetItem {
  type: "snippet";
  name: string;
  content: string;
  language: string;
  path?: string;
}

export interface ChatSessionHistory {
  id: string;
  title: string;
  time: number;
  data: ChatMessage[];
}

export interface Session {
  id: number;
  summary: string;
  age: string;
}

export interface SessionChatContent {
  text: string;
  language: string;
  code: string;
  filePath: string;
  toolName: string;
  toolUseId: string;
  inputParamsJson: JSON;
  resultJson: JSON;
  user: string; // TODO: need to change this
}

export interface sessionChats {
  type: string;
  actor: string;
  content: SessionChatContent;
}

export type ChatChunkMessage = {
  chunk: string;
  error: string;
};

export type ChatAutocompleteOptions = AutocompleteOption[];

export const initialAutocompleteOptions: AutocompleteOption[] = [
  {
    icon: "directory",
    label: "Directory",
    value: "Directory: ",
    description: "A folder containing files and subfolders",
    chunks: []
  },
  {
    icon: "file",
    label: "File",
    value: "File: ",
    description: "A single file such as a document or script",
    chunks: []
  },
  {
    icon: "function",
    label: "Function",
    value: "Function: ",
    description: "A short piece of reusable code",
    chunks: []
  },
  {
    icon: "class",
    label: "Class",
    value: "Class: ",
    description: "A short piece of reusable class code",
    chunks: []
  },
];

/*===========================================================================
  Chat Store
===========================================================================*/

export const useChatStore = create(
  combine(
    {
      history: [] as ChatMessage[],
      current: undefined as ChatAssistantMessage | undefined,
      currentChatRequest: undefined as any,
      isLoading: false,
      showSessionsBox: true,
      showAllSessions: false,
      sessions: [] as Session[],
      sessionChats: [] as sessionChats[],
      currentEditorReference: [] as ChatReferenceItem[],
      ChatAutocompleteOptions: initialAutocompleteOptions,
      chipIndexBeingEdited: -1,
      lastToolUseResponse: undefined as
        | { tool_use_id: string; tool_name: string }
        | undefined,
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
            sessionChats: [],
          });
        },

        async sendChatMessage(
          message: string,
          editorReferences: ChatReferenceItem[],
          chunkCallback: (data: { name: string; data: any }) => void
        ) {
          logToOutput("info", `sendChatMessage: ${message}`);
          const { history, lastToolUseResponse } = get();

          // Create the user message
          const userMessage: ChatUserMessage = {
            type: "TEXT_BLOCK",
            content: { text: message },
            referenceList: editorReferences,
            actor: "USER",
          };

          set({
            history: [...history, userMessage],
            current: {
              type: "TEXT_BLOCK",
              content: { text: "" },
              actor: "ASSISTANT",
            },
            isLoading: true,
          });

          // Build the payload
          const payload: any = {
            query: message,
            is_tool_response: false,
            relevant_chunks: [] as string[],
            write_mode: useChatSettingStore.getState().chatType === "write",
            referenceList: userMessage.referenceList,
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

          const stream = apiChat(payload);
          console.log("stream received in FE : ", stream);

          try {
            for await (const event of stream) {
              switch (event.name) {
                case "TEXT_START": {
                  // Initialize a new current message with the desired structure
                  set((state) => ({
                    current: state.current || {
                      type: "TEXT_BLOCK",
                      content: { text: "" },
                      actor: "ASSISTANT",
                    },
                  }));
                  chunkCallback({ name: "TEXT_START", data: event.data });
                  break;
                }

                case "TEXT_DELTA": {
                  const textChunk = (event.data as any)?.text || "";

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

                  chunkCallback({ name: "TEXT_DELTA", data: event.data });
                  break;
                }

                case "TEXT_BLOCK_END": {
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

                  chunkCallback({ name: "TEXT_BLOCK_END", data: event.data });
                  break;
                }

                case "THINKING_BLOCK_START": {
                  const thinkingContent = (event.data as any)?.content || {
                    text: "",
                  };

                  set((state) => ({
                    history: [
                      ...state.history,
                      {
                        type: "THINKING",
                        text: thinkingContent.text,
                        content: thinkingContent,
                        completed: false,
                        actor: "ASSISTANT",
                      } as ThinkingMessage,
                    ],
                  }));

                  chunkCallback({
                    name: "THINKING_BLOCK_START",
                    data: event.data,
                  });
                  break;
                }

                case "THINKING_BLOCK_DELTA": {
                  const thinkingDelta =
                    (event.data as any)?.thinking_delta || "";

                  set((state) => {
                    const newHistory = [...state.history];
                    const lastMsg = newHistory[newHistory.length - 1];

                    if (lastMsg?.type === "THINKING") {
                      lastMsg.text += thinkingDelta;
                      lastMsg.text += thinkingDelta; // Ensure content.text is updated as well
                    }

                    return { history: newHistory };
                  });

                  chunkCallback({
                    name: "THINKING_BLOCK_DELTA",
                    data: event.data,
                  });
                  break;
                }

                case "THINKING_BLOCK_END": {
                  set((state) => {
                    const newHistory = [...state.history];
                    const lastMsg = newHistory[newHistory.length - 1];

                    if (lastMsg?.type === "THINKING") {
                      lastMsg.completed = true;
                    }

                    return { history: newHistory };
                  });

                  chunkCallback({
                    name: "THINKING_BLOCK_END",
                    data: event.data,
                  });
                  break;
                }

                case "CODE_BLOCK_START": {
                  const codeData = event.data as {
                    language?: string;
                    filepath?: string;
                    is_diff?: boolean;
                  };

                  const codeBlockMsg: ChatCodeBlockMessage = {
                    type: "CODE_BLOCK",
                    content: {
                      language: codeData.language || "",
                      file_path: codeData.filepath,
                      code: "",
                      is_diff: codeData.is_diff || false, // ✅ Save is_diff here
                    },
                    completed: false,
                    actor: "ASSISTANT",
                  };

                  set((state) => ({
                    history: [...state.history, codeBlockMsg],
                  }));

                  chunkCallback({ name: "CODE_BLOCK_START", data: event.data });
                  break;
                }

                case "CODE_BLOCK_DELTA": {
                  const codeData = event.data as { code_delta?: string };
                  const codeDelta = codeData.code_delta || "";

                  set((state) => {
                    const newHistory = [...state.history];
                    const lastMsg = newHistory[newHistory.length - 1];

                    if (lastMsg?.type === "CODE_BLOCK") {
                      lastMsg.content.code += codeDelta; // Update the code inside content
                    }

                    return { history: newHistory };
                  });

                  chunkCallback({ name: "CODE_BLOCK_DELTA", data: event.data });
                  break;
                }

                case "CODE_BLOCK_END": {
                  console.log("Raw event data:", event.data);
                  const endData = event.data as {
                    diff: string | null;
                    added_lines: number | null;
                    removed_lines: number | null;
                  };
                  logToOutput("info", `code end data ${endData.diff}`);

                  set((state) => {
                    const newHistory = [...state.history];
                    const lastMsg = newHistory[newHistory.length - 1];

                    if (lastMsg?.type === "CODE_BLOCK") {
                      lastMsg.completed = true;

                      // ✅ Update diff info
                      lastMsg.content.diff = endData.diff;
                      lastMsg.content.added_lines = endData.added_lines;
                      lastMsg.content.removed_lines = endData.removed_lines;
                    }

                    return { history: newHistory };
                  });

                  chunkCallback({ name: "CODE_BLOCK_END", data: event.data });
                  break;
                }

                case "TOOL_USE_REQUEST_START": {
                  const toolData = event.data as {
                    tool_name?: string;
                    tool_use_id?: string;
                  };
                  if (toolData.tool_name === "ask_user_input") {
                    // For ask_user_input, create an assistant message.
                    set({
                      current: {
                        type: "TEXT_BLOCK",
                        content: { text: "" },
                        actor: "ASSISTANT",
                      },
                    });
                  } else {
                    // For normal tools, create a tool use message.
                    const newToolMsg: ChatToolUseMessage = {
                      type: "TOOL_USE_REQUEST_BLOCK",
                      content: {
                        tool_name: toolData.tool_name || "",
                        tool_use_id: toolData.tool_use_id || "",
                        input_params_json: "",
                        result_json: "",
                        status: "in-progress",
                      },
                    };
                    set((state) => ({
                      history: [...state.history, newToolMsg],
                    }));
                  }
                  chunkCallback({ name: event.name, data: event.data });
                  break;
                }
                case "TOOL_USE_REQUEST_DELTA": {
                  const { delta, tool_use_id, tool_name } = event.data as {
                    tool_name: string;
                    delta: string;
                    tool_use_id: string;
                  };
                  if (tool_name === "ask_user_input") {
                    // Accumulate JSON and try to extract prompt.
                    set((state) => {
                      if (!state.current || state.current.type !== "TEXT_BLOCK")
                        return state;
                      const currentAccumulated =
                        state.current.content.text + delta;
                      let extractedPrompt = "";
                      try {
                        const potentialJsonMatch =
                          currentAccumulated.match(/\{.*\}/s);
                        if (potentialJsonMatch) {
                          const parsedJson = JSON.parse(potentialJsonMatch[0]);
                          if (parsedJson.prompt) {
                            extractedPrompt = parsedJson.prompt;
                          }
                        }
                      } catch (e) {
                        // Continue accumulating if JSON parsing fails.
                      }
                      return {
                        current: {
                          ...state.current,
                          text: extractedPrompt || currentAccumulated,
                        },
                      };
                    });
                  } else {
                    set((state) => {
                      const newHistory = state.history.map((msg) => {
                        if (msg.type === "TOOL_USE_REQUEST_BLOCK") {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                input_params_json:
                                  toolMsg.content.input_params_json + delta, // ✅ Correctly updating inside content
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return { history: newHistory };
                    });
                  }
                  chunkCallback({ name: event.name, data: event.data });
                  break;
                }
                case "TOOL_USE_REQUEST_END": {
                  const { tool_name, tool_use_id } = event.data as {
                    tool_name: string;
                    tool_use_id: string;
                  };
                  if (tool_name === "ask_user_input") {
                    // Finalize the assistant message.
                    set((state) => {
                      if (!state.current) return state;
                      let finalText = state.current.content?.text;
                      try {
                        if (
                          finalText.trim().startsWith("{") &&
                          finalText.trim().endsWith("}")
                        ) {
                          const parsedJson = JSON.parse(finalText);
                          if (parsedJson.prompt) {
                            finalText = parsedJson.prompt;
                          }
                        }
                      } catch (e) {
                        // Use the text as is if parsing fails.
                      }
                      return {
                        history: [
                          ...state.history,
                          { ...state.current, text: finalText },
                        ],
                        current: undefined,
                        lastToolUseResponse: { tool_use_id, tool_name },
                      };
                    });
                  } else {
                    set((state) => {
                      const newHistory = state.history.map((msg) => {
                        if (msg.type === "TOOL_USE_REQUEST_BLOCK") {
                          const toolMsg = msg as ChatToolUseMessage;
                          if (toolMsg.content.tool_use_id === tool_use_id) {
                            return {
                              ...toolMsg,
                              content: {
                                ...toolMsg.content,
                                status: "in-progress" as "in-progress", // ✅ Explicitly setting the correct type
                              },
                            };
                          }
                        }
                        return msg;
                      });
                      return { history: newHistory };
                    });
                  }
                  chunkCallback({ name: event.name, data: event.data });
                  break;
                }
                case "TOOL_USE_RESULT": {
                  const toolResultData = event.data as {
                    tool_name: string;
                    tool_use_id: string;
                    result_json: string;
                    status: "completed" | "error";
                  };
                  set((state) => {
                    const newHistory = state.history.map((msg) => {
                      if (msg.type === "TOOL_USE_REQUEST_BLOCK") {
                        const toolMsg = msg as ChatToolUseMessage;
                        if (
                          toolMsg.content.tool_use_id ===
                          toolResultData.tool_use_id
                        ) {
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
                case "error": {
                  const errorData = event.data as { error?: string };
                  const err = errorData.error || "Unknown error";
                  logToOutput("error", `Streaming error: ${err}`);
                  showErrorMessage(`Error: ${err}`);
                  set({ isLoading: false, currentChatRequest: undefined });
                  chunkCallback({ name: "error", data: { error: err } });
                  break;
                }
                case "end": {
                  set({ isLoading: false, currentChatRequest: undefined });
                  logToOutput("info", "Chat stream ended");
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
                  chunkCallback({ name: "end", data: {} });
                  break;
                }
                default: {
                  chunkCallback({ name: event.name, data: event.data });
                  break;
                }
              }
            }
          } catch (err) {
            logToOutput("error", `Error: ${String(err)}`);
            showErrorMessage(`Error: ${String(err)}`);
            set({ isLoading: false });
          }
        },

        cancelChat() {
          const { currentChatRequest } = get();
          currentChatRequest?.close();
          set({ currentChatRequest: undefined, isLoading: false });
          logToOutput("info", "User canceled the chat stream");
        },
      };
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
        chatType: "ask" as ChatType,
      },
      (set) => ({
        setChatType(nextChatType: ChatType) {
          set({ chatType: nextChatType });
        },
      })
    ),
    {
      name: "chat",
      storage: persistStorage,
      partialize: (state) => pick(state, ["chatType"]),
    }
  )
);

// =============================================================================
// CHAT SESSION STORE (Persistence Example)
// =============================================================================

export const useChatSessionStore = create(
  persist(
    combine(
      {
        sessions: [] as ChatSessionHistory[],
      },
      (set) => ({
        setSessions(nextSessions: ChatSessionHistory[]) {
          set({ sessions: nextSessions });
        },
        addSession(id: string, data: ChatMessage[]) {
          if (!id) {
            console.error("id is required");
            return;
          }
          set((state) => {
            const existing = state.sessions.find((s) => s.id === id);
            if (existing) {
              return {
                sessions: state.sessions.map((s) =>
                  s.id === id ? { ...s, data, time: Date.now() } : s
                ),
              };
            }
            const title =
              data.length > 0
                ? (data[0] as ChatAssistantMessage).content.text
                    .trim()
                    .slice(0, 50)
                : "New Session";
            return {
              sessions: [
                ...state.sessions,
                { id, title, time: Date.now(), data },
              ],
            };
          });
        },
        deleteSession(id: string) {
          set((state) => ({
            sessions: state.sessions.filter((s) => s.id !== id),
          }));
        },
      })
    ),
    {
      name: "sessions",
      storage: persistStorage,
    }
  )
);

/**
 * Loads a chat session by its ID and updates the chat store.
 */
export async function setChatSession(sessionId: string) {
  const session = useChatSessionStore
    .getState()
    .sessions.find((s) => s.id === sessionId);
  if (!session) {
    console.error("Session not found");
    return;
  }
  // Convert stored messages to API payload format.
  await apiSaveSession(
    session.data.map((msg) => ({
      role: msg.type,
      // content: msg.text,
    }))
  );
  useChatStore.setState({ history: session.data });
}
