// file: webview-ui/src/stores/chatStore.ts
import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';
import { SSE } from 'sse.js';
import { v4 as uuidv4 } from 'uuid';


import {
  apiChat,
  apiClearChat,
  apiSaveSession,
  cancelGenerateCode,
  logToOutput,
  showErrorMessage,
  showInfoMessage,
  writeFile,
} from '@/commandApi';

import { persistStorage } from './lib';
import pick from 'lodash/pick';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type ChatChunkMessage = {
  chunk: string;
  error: string;
};

export type ChatType = 'ask' | 'write';

/**
 * Placeholder for future reference types.
 * Extend these interfaces later as needed.
 */
export interface ChatReferenceFileItem {
  id: string;
  type: 'file';
  name: string;
  fsPath: string;
  // Additional fields such as range, etc.
}
export interface ChatReferenceDirectoryItem {
  id: string;
  type: 'directory';
  name: string;
  fsPath: string;
}
export interface ChatReferenceFunctionItem {
  id: string;
  type: 'function';
  name: string;
  fsPath: string;
  // Additional function-specific fields.
}

export type ChatReferenceItem =
  | ChatReferenceSnippetItem
  | ChatReferenceFileItem
  | ChatReferenceDirectoryItem
  | ChatReferenceFunctionItem;

export interface ChatUserMessage {
  id: string;
  type: 'user';
  text: string;
  displayText: string;
  referenceList: ChatReferenceItem[];
  reflected?: boolean;
}

export interface ChatAssistantMessage {
  id: string;
  type: 'assistant';
  text: string;
  usage?: string;
}

export type ChatMessage = ChatAssistantMessage | ChatUserMessage;

export interface ChatReferenceSnippetItem {
  id: string;
  type: 'snippet';
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

// Regular expression to detect the start of a code snippet (e.g. "```language")
const CODE_SNIPPET_START_REGEX = /```([a-zA-Z0-9_-]+)\s*/;

// =============================================================================
// CHAT STORE (Webview)
// =============================================================================

export const useChatStore = create(
  combine(
    {
      // sessionId represents a unique session maintained throughout the session
      sessionId: uuidv4(),
      history: [] as ChatMessage[],
      // The current assistant message being streamed
      current: undefined as ChatAssistantMessage | undefined,
      // The active stream (if any) from our API (assumed to support a close() method)
      currentChatRequest: undefined as SSE | undefined,
      // Snippet-detection state
      detectedSnippets: {} as { [key: string]: ChatReferenceSnippetItem },
      currentSnippetId: null as string | null,
      isInSnippet: false,
      buffer: '',
      isLoading: false,
      showSessionsBox: true,
      showAllSessions: false,
      sessions: [] as Session[],
      sessionChats: [] as sessionChats[],
    },
    (set, get) => ({
      async clearChat() {
        // Clear current session and start a new one by generating a new sessionId.
        set({
          sessionId: uuidv4(),
          history: [],
          current: undefined,
          detectedSnippets: {},
          currentSnippetId: null,
          isInSnippet: false,
          buffer: '',
          currentChatRequest: undefined,
          isLoading: false,
          showSessionsBox: true,
          showAllSessions: false,
          sessionChats: []
        });
      },

      async sendChatMessage(message: string) {
        logToOutput('info', `sendChatMessage: ${message}`);
        const { history } = get();

        // Generate a unique ID for the user message.
        const userMessageId = uuidv4();

        // Append the user message to the UI history and create a placeholder for the assistant.
        set({
          history: [
            ...history,
            {
              id: userMessageId,
              type: 'user',
              text: message,
              displayText: message,
              referenceList: [],
            } as ChatUserMessage,
          ],
          current: { id: uuidv4(), type: 'assistant', text: '' },
          isLoading: true,
          detectedSnippets: {},
          currentSnippetId: null,
          isInSnippet: false,
          buffer: '',
        });

        // Prepare the payload for the API.
        const payload = {
          // session_id: get().sessionId,
          message_id: userMessageId,
          query: message,
          relevant_chunks: [] as string[],
          chat_type: useChatSettingStore.getState().chatType,
        };

        // Call our API (which returns an async iterable stream).
        const stream = apiChat(payload);
        console.log('stream received in FE : ', stream);

        try {
          for await (const event of stream) {
            switch (event.name) {
              case 'data': {
                const chunk = (event.data as ChatChunkMessage).chunk;
                set((state) => {
                  console.log("final chunks at ui", chunk)
                  let combinedText = state.buffer + chunk;
                  let newBuffer = '';
                  let currentText = state.current ? state.current.text : '';
                  let { isInSnippet, currentSnippetId, detectedSnippets } = state;
                  let pos = 0;

                  while (pos < combinedText.length) {
                    if (!isInSnippet) {
                      const startMatch = CODE_SNIPPET_START_REGEX.exec(
                        combinedText.substring(pos)
                      );
                      if (startMatch) {
                        const markerPos = combinedText.indexOf(startMatch[0], pos);
                        currentText += combinedText.substring(pos, markerPos);
                        isInSnippet = true;
                        const snippetId = uuidv4();
                        currentSnippetId = snippetId;
                        const language = startMatch[1];

                        detectedSnippets = {
                          ...detectedSnippets,
                          [snippetId]: {
                            id: snippetId,
                            type: 'snippet',
                            name: `Detected Snippet: ${language}`,
                            content: '',
                            language,
                            path: '/snippets/auto-detected/codeblock.txt',
                          },
                        };

                        currentText += `[[CODE_SNIPPET_${snippetId}]]`;
                        pos = markerPos + startMatch[0].length;
                      } else {
                        currentText += combinedText.substring(pos);
                        pos = combinedText.length;
                        break;
                      }
                    } else {
                      const endPos = combinedText.indexOf('```', pos);
                      if (endPos === -1) {
                        if (currentSnippetId) {
                          detectedSnippets[currentSnippetId].content +=
                            combinedText.substring(pos);
                        }
                        pos = combinedText.length;
                        break;
                      } else {
                        if (currentSnippetId) {
                          const snippetContent = combinedText.substring(pos, endPos).trim();
                          detectedSnippets[currentSnippetId].content += snippetContent;
                        }
                        isInSnippet = false;
                        currentSnippetId = null;
                        pos = endPos + 3;
                      }
                    }
                  }

                  if (pos < combinedText.length) {
                    newBuffer = combinedText.substring(pos);
                  }

                  return {
                    current: state.current ? { ...state.current, text: currentText } : state.current,
                    detectedSnippets,
                    isInSnippet,
                    currentSnippetId,
                    buffer: newBuffer,
                  };
                });
                // Yield control to allow UI updates.
                break;
              }

              case 'end': {
                set({ isLoading: false, currentChatRequest: undefined });
                set((state) => ({
                  history: state.current ? [...state.history, state.current] : state.history,
                  current: undefined,
                }));
                showInfoMessage('Finished responding');
                await apiSaveSession({
                  session: get().history.map((msg) => ({
                    role: msg.type,
                    content: msg.text,
                  })),
                });
                break;
              }

              case 'error': {
                const err =
                  (event.data as ChatChunkMessage).error || 'Unknown error';
                logToOutput('error', `Streaming error: ${err}`);
                showErrorMessage(`Error: ${err}`);
                set({ isLoading: false, currentChatRequest: undefined });
                break;
              }
            }
          }
        } catch (err) {
          logToOutput('error', `Error: ${String(err)}`);
          showErrorMessage(`Error: ${String(err)}`);
          set({ isLoading: false });
        }
      },

      cancelChat() {
        const { currentChatRequest } = get();
        // Use close() instead of abort() to cancel the stream.
        currentChatRequest?.close();
        set({ currentChatRequest: undefined, isLoading: false });
        logToOutput('info', 'User canceled the chat stream');
      },
    })
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
      },
      (set) => ({
        setChatType(nextChatType: ChatType) {
          set({ chatType: nextChatType });
        },
      })
    ),
    {
      name: 'chat',
      storage: persistStorage,
      partialize: (state) => pick(state, ['chatType']),
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
            console.error('id is required');
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
                ? data[0].type === 'user'
                  ? (data[0] as ChatUserMessage).displayText.trim().slice(0, 50)
                  : (data[0] as ChatAssistantMessage).text.trim().slice(0, 50)
                : 'New Session';
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
      name: 'sessions',
      storage: persistStorage,
    }
  )
);

/**
 * Loads a chat session by its ID and updates the chat store.
 */
export async function setChatSession(sessionId: string) {
  const session = useChatSessionStore.getState().sessions.find((s) => s.id === sessionId);
  if (!session) {
    console.error('Session not found');
    return;
  }
  // Convert stored messages to API payload format.
  await apiSaveSession(
    session.data.map((msg) => ({
      role: msg.type,
      content: msg.text,
    }))
  );
  useChatStore.setState({ sessionId: sessionId, history: session.data });
}
