// =============================================================================
// CHAT SETTING STORE
// =============================================================================

import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';

import { ChatType } from '@/types';

import { persistGlobalStorage } from './lib';
import pick from 'lodash/pick';

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
