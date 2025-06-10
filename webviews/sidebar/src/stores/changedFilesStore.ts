import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { ChangedFilesStorage } from '@/types';

export const useChangedFilesStore = create<ChangedFilesStorage>()(
  persist(
    (set) => ({
      changedFiles: [],
      filesChangedSessionId: 0
    }),
    {
      name: 'changed-files-storage',
      storage: persistStorage,
    }
  )
);
