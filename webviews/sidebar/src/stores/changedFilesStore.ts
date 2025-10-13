import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { ChangedFile } from '@/types';
import { FALLBACK_CHAT_ID, useChatStore } from '@/stores/chatStore';

export interface ChangedFilesGroup {
  sessionId: number;
  files: ChangedFile[];
}

export interface ChangedFilesStorage {
  changedFiles: ChangedFile[];
  deleteFilesBySessionId: (sessionId: number) => void;
}

export const useChangedFilesStore = create<ChangedFilesStorage>()(
  persist(
    (set, get) => ({
      changedFiles: [],
      deleteFilesBySessionId: (sessionId: number) =>
        set((state) => {
          const updatedFiles = state.changedFiles.filter((file) => file.sessionId !== sessionId);
          return {
            changedFiles: updatedFiles,
          };
        }),
    }),
    {
      name: 'changed-files-storage',
      storage: persistStorage,
    }
  )
);

/**
 * Helper — Groups changed files by session, respecting current chat context.
 */
export function groupChangedFiles(
  changedFiles: ChangedFile[],
  sessionId?: number
): ChangedFilesGroup[] {
  const chatStore = useChatStore.getState();
  const currentChat = chatStore.getCurrentChat(); // returns ChatSession | undefined
  const currentSessionId = sessionId ?? currentChat?.sessionId;

  if (!changedFiles.length) return [];
  if (chatStore.currentChatId === FALLBACK_CHAT_ID) return []; // Fallback chat → no files
  // Specific chat session → only that session's files
  if (currentSessionId) {
    const files = changedFiles.filter((f) => f.sessionId === currentSessionId);
    if (files.length === 0) return [];
    return [
      {
        sessionId: currentSessionId,
        files,
      },
    ];
  }

  return [];
}

useChangedFilesStore.subscribe((state) => {
  const changedFiles = state.changedFiles;
  const chatStore = useChatStore.getState();

  // count files per session
  const countsBySession = changedFiles.reduce<Record<number, number>>((acc, file) => {
    acc[file.sessionId] = (acc[file.sessionId] || 0) + (file.accepted ? 0 : 1);
    return acc;
  }, {});

  // update chats that have matching sessionId
  for (const [chatId, chat] of Object.entries(chatStore.chats)) {
    if (chat.sessionId) {
      const count = countsBySession[chat.sessionId] || 0;
      chatStore.chats[chatId].changedFiles = count;
    }
  }
});
