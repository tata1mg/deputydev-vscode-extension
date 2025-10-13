import { useChangedFilesStore } from '@/stores/changedFilesStore';
import { FALLBACK_CHAT_ID, useChatStore } from '@/stores/chatStore';

export function resetChatState(): void {
  const chatStore = useChatStore.getState();
  const { deleteFilesBySessionId } = useChangedFilesStore.getState();
  // 1️⃣ Iterate over all chats
  Object.entries(chatStore.chats).forEach(([chatId, chat]) => {
    // --- A. Normalize chat status before any deletion logic ---
    if (chat.status.type === 'in_progress' || chat.status.type === 'action_required') {
      // ✅ Use setState to update one chat entry safely
      useChatStore.setState((state) => ({
        ...state,
        chats: {
          ...state.chats,
          [chatId]: { ...state.chats[chatId], status: { type: 'aborted', message: undefined } },
        },
      }));
    }

    // --- B. Skip fallback chat — we never delete that ---
    if (chatId === FALLBACK_CHAT_ID) return;

    const isHistoryChat = chat.status.type === 'history';

    // --- D. Remove chats that are too old or are history ---
    if (isHistoryChat) {
      chatStore.deleteChat(chatId);
      if (chat.sessionId) deleteFilesBySessionId(chat.sessionId);
      if (chat.sessionId) deleteFilesBySessionId(chat.sessionId);
    }
  });
}
