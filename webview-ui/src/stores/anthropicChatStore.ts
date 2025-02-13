// file: webview-ui/src/stores/anthropicChatStore.ts
import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { Anthropic } from '@anthropic-ai/sdk';
import {
  logToOutput,
  showErrorMessage,
  showInfoMessage,
  setGlobalState,
  getGlobalState,
  apiSaveSession,
} from '../commandApi';
import { persistStorage } from './lib';

// For session store persistence.
import pick from 'lodash/pick';
import { combine, persist } from 'zustand/middleware';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Represents a single chat message.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Represents a detected code snippet.
 */
export interface ChatReferenceSnippetItem {
  id: string;
  type: 'snippet';
  name: string;
  content: string;
  language: string;
  path?: string;
}

/**
 * Represents a chat session history.
 */
export interface ChatSessionHistory {
  id: string;
  title: string;
  time: number;
  data: ChatMessage[];
}

/**
 * Anthropic Chat Store interface.
 */
interface AnthropicChatStore {
  chatId: string;
  systemPrompt: string;
  messages: ChatMessage[];
  isLoading: boolean;
  activeStream: ReturnType<Anthropic['messages']['stream']> | null;
  detectedSnippets: { [key: string]: ChatReferenceSnippetItem };
  currentSnippetId: string | null;
  isInSnippet: boolean;
  buffer: string;
  mode: 'chat' | 'write';

  // Functions (must remain with these names)
  setSystemPrompt: (prompt: string) => void;
  setMode: (mode: 'chat' | 'write') => void;
  sendChatMessage: (userText: string) => Promise<void>;
  sendWriteMessage: (userText: string) => Promise<void>;
  cancelChat: () => void;
}

// =============================================================================
// CONSTANTS & INITIALIZATION
// =============================================================================

// Initialize the Anthropic client.
const anthropicClient = new Anthropic({
  apiKey: import.meta.env.VITE_NEXT_PUBLIC_ANTHROPIC_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

// Regular expression to detect the start of a code snippet (e.g., "```language").
const CODE_SNIPPET_START_REGEX = /```([a-zA-Z0-9_-]+)\s*/;

// =============================================================================
// ANTHROPIC CHAT STORE
// =============================================================================

export const useAnthropicChatStore = create<AnthropicChatStore>((set, get) => {
  /**
   * Internal helper to send a message and handle streaming responses.
   * @param userText - The user's input text.
   * @param mode - The mode of operation: 'chat' or 'write'.
   */
  const sendMessage = async (userText: string, mode: 'chat' | 'write') => {
    logToOutput('info', `${mode} message: ${userText}`);

    const { messages, systemPrompt, activeStream } = get();

    // Abort any ongoing stream.
    activeStream?.abort();

    // Append the user's message and prepare an empty assistant response.
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userText },
      { role: 'assistant', content: '' },
    ];
    const assistantMsgIndex = updatedMessages.length - 1;

    // Reset snippet-related state.
    set({
      messages: updatedMessages,
      isLoading: true,
      activeStream: null,
      currentSnippetId: null,
      isInSnippet: false,
      buffer: '',
    });

    try {
      const stream = await anthropicClient.messages.stream({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: updatedMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      set({ activeStream: stream });

      // Process incoming text chunks.
      stream.on('text', (chunk: string) => {
        set((state) => {
          // Combine any leftover buffer with the new chunk.
          let combinedText = state.buffer + chunk;
          let newBuffer = '';
          let assistantContent = state.messages[assistantMsgIndex].content;
          let { isInSnippet, currentSnippetId, detectedSnippets } = state;
          let currentPos = 0;

          // Process the combined text for snippet markers.
          while (currentPos < combinedText.length) {
            if (!isInSnippet) {
              // Search for the start marker of a code snippet.
              const startMatch = CODE_SNIPPET_START_REGEX.exec(
                combinedText.substring(currentPos)
              );
              if (startMatch) {
                const markerPos = combinedText.indexOf(startMatch[0], currentPos);
                // Append text before the snippet marker.
                assistantContent += combinedText.substring(currentPos, markerPos);
                // Enter snippet mode.
                isInSnippet = true;
                const snippetId = nanoid();
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

                // Insert a placeholder for the snippet in the assistant's message.
                assistantContent += `[[CODE_SNIPPET_${snippetId}]]`;
                // Advance currentPos past the snippet start marker.
                currentPos = markerPos + startMatch[0].length;
              } else {
                // No snippet start marker found; append the remaining text.
                assistantContent += combinedText.substring(currentPos);
                currentPos = combinedText.length;
                break;
              }
            } else {
              // Inside a snippet: look for the closing marker.
              const closingMarkerPos = combinedText.indexOf("```", currentPos);
              if (closingMarkerPos === -1) {
                // No closing marker in this chunk; add all remaining text to the snippet.
                if (currentSnippetId) {
                  detectedSnippets[currentSnippetId].content += combinedText.substring(currentPos);
                }
                currentPos = combinedText.length;
                break;
              } else {
                // Closing marker found; update the snippet content.
                if (currentSnippetId) {
                  const snippetContent = combinedText.substring(currentPos, closingMarkerPos).trim();
                  detectedSnippets[currentSnippetId].content += snippetContent;
                }
                // Exit snippet mode.
                isInSnippet = false;
                currentSnippetId = null;
                currentPos = closingMarkerPos + 3; // Skip the closing backticks.
              }
            }
          }

          // Save any unprocessed text to the buffer.
          if (currentPos < combinedText.length) {
            newBuffer = combinedText.substring(currentPos);
          }

          // Update the assistant's message content.
          const updatedMessages = [...state.messages];
          updatedMessages[assistantMsgIndex].content = assistantContent;

          return {
            messages: updatedMessages,
            detectedSnippets,
            isInSnippet,
            currentSnippetId,
            buffer: newBuffer,
          };
        });
      });

      // When the stream ends, update the state and save the session.
      stream.on('end', () => {
        set({ isLoading: false, activeStream: null });
        showInfoMessage(`Anthropic finished responding in ${mode} mode`);
        useChatSessionStore.getState().addSession(get().chatId, get().messages);
      });

      // Handle stream abort.
      stream.on('abort', () => {
        set({ isLoading: false, activeStream: null });
        showInfoMessage('Streaming aborted');
      });

      // Handle any stream errors.
      stream.on('error', (err: Error) => {
        logToOutput('error', `Anthropic streaming error: ${String(err)}`);
        showErrorMessage(`Anthropic Error: ${String(err)}`);
        set({ isLoading: false, activeStream: null });
      });
    } catch (err) {
      logToOutput('error', `Anthropic error: ${String(err)}`);
      showErrorMessage(`Anthropic error: ${String(err)}`);
      set({ isLoading: false, activeStream: null });
    }
  };

  return {
    chatId: nanoid(),
    systemPrompt: 'You are an expert software engineer.',
    messages: [],
    isLoading: false,
    activeStream: null,
    detectedSnippets: {},
    currentSnippetId: null,
    isInSnippet: false,
    buffer: '',
    mode: 'chat',

    // Updates the system prompt.
    setSystemPrompt: (prompt: string) => {
      set({ systemPrompt: prompt });
      setGlobalState({ key: 'anthropic-system-prompt', value: prompt });
      logToOutput('info', `Updated system prompt to "${prompt}"`);
    },

    // Sets the current mode (chat or write); prevents switching while loading.
    setMode: (newMode: 'chat' | 'write') => {
      if (get().isLoading) {
        showInfoMessage("Cannot switch mode while receiving a response.");
        return;
      }
      set({ mode: newMode });
      logToOutput('info', `Switched mode to ${newMode}`);
    },

    // Sends a chat-mode message.
    sendChatMessage: async (userText: string) => {
      await sendMessage(userText, 'chat');
    },

    // Sends a write-mode message.
    sendWriteMessage: async (userText: string) => {
      await sendMessage(userText, 'write');
    },

    // Cancels an ongoing chat stream.
    cancelChat: () => {
      const { activeStream } = get();
      if (activeStream) {
        activeStream.abort();
        logToOutput('info', 'User canceled the stream');
      }
      set({ isLoading: false, activeStream: null });
    },
  };
});

// =============================================================================
// CHAT SESSION STORE
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
        addSession(sessionId: string, messages: ChatMessage[]) {
          if (!sessionId) {
            console.error('sessionId is required');
            return;
          }
          set((state) => {
            const existingSessionIndex = state.sessions.findIndex(
              (session) => session.id === sessionId
            );
            if (existingSessionIndex !== -1) {
              // Update the existing session.
              const updatedSessions = state.sessions.map((session) =>
                session.id === sessionId
                  ? { ...session, data: messages, time: Date.now() }
                  : session
              );
              return { sessions: updatedSessions };
            }
            // Create a new session with a simple title based on the first message.
            const title =
              messages.length > 0
                ? messages[0].content.trim().slice(0, 50)
                : 'New Session';
            return {
              sessions: [
                ...state.sessions,
                { id: sessionId, title, time: Date.now(), data: messages },
              ],
            };
          });
        },
        deleteSession(sessionId: string) {
          set((state) => ({
            sessions: state.sessions.filter((session) => session.id !== sessionId),
          }));
        },
      })
    ),
    {
      name: 'sessions',
      storage: persistStorage,
      partialize: (state) => pick(state, ['sessions']),
    }
  )
);

// =============================================================================
// SESSION LOADER
// =============================================================================

/**
 * Loads a chat session by its ID and updates the Anthropic chat store.
 * @param sessionId - The ID of the session to load.
 */
export async function setChatSession(sessionId: string) {
  const session = useChatSessionStore
    .getState()
    .sessions.find((s) => s.id === sessionId);
  if (!session) {
    console.error('Session not found');
    return;
  }
  await apiSaveSession(
    session.data.map((msg) => ({ role: msg.role, content: msg.content }))
  );
  useAnthropicChatStore.setState({ chatId: sessionId, messages: session.data });
}
