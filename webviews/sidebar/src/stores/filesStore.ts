import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { FilesStorage } from '@/types';

export const useFileStore = create<FilesStorage>()(
  persist(
    (set) => ({
      changedFiles: [],
      filesChangedSessionId: 0,
      selectedChangedFile: {
        filePath: "",
        repoPath: "",
        addedLines: [],
        removedLines: [],
        sessionId: 0,
        accepted: false
      }
    }),
    {
      name: 'files-storage',
      storage: persistStorage,
    }
  )
);
