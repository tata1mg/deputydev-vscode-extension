import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { FilesStorage } from '@/types';

export const useFileStore = create<FilesStorage>()(
  persist(
    (set) => ({
      changedFiles: [],
      selectedChangedFile: {
        fileName: "",
        filePath: "",
        linesAdded: 0,
        linesRemoved: 0,
        accepted: false
      },
    }),
    {
      name: 'files-storage',
      storage: persistStorage,
    }
  )
);
