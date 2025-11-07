// store/indexingStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { IndexingProgressData, ProgressStatus } from '@/types';

type IndexingStore = {
  indexingProgressData: IndexingProgressData[];
  initializeRepos: (repoPaths: { repoPath: string }[]) => void;
  updateOrAppendIndexingData: (data: IndexingProgressData) => void;
};

export const useIndexingStore = create<IndexingStore>()(
  persist(
    (set, get) => ({
      indexingProgressData: [],

      initializeRepos: (repoPaths) => {
        const currentData = get().indexingProgressData;
        const existingPaths = new Set(currentData.map((item) => item.repo_path));

        const newRepos = repoPaths
          .filter((repo) => !existingPaths.has(repo.repoPath))
          .map((repo) => ({
            task: 'INDEXING',
            status: 'IDLE' as ProgressStatus,
            repo_path: repo.repoPath,
            indexed_files: [],
          }));

        if (newRepos.length > 0) {
          set((state) => ({
            indexingProgressData: [...state.indexingProgressData, ...newRepos],
          }));
        }
      },

      updateOrAppendIndexingData: (newData) => {
        set((state) => {
          const existingIndex = state.indexingProgressData.findIndex(
            (item) => item.repo_path === newData.repo_path
          );

          if (existingIndex >= 0) {
            // Update existing entry
            const existing = state.indexingProgressData[existingIndex];
            const mergedFiles = Array.from(
              new Set([...existing.indexed_files, ...newData.indexed_files])
            );

            const updatedItem: IndexingProgressData = {
              ...existing,
              ...newData,
              indexed_files: mergedFiles,
            };

            const updatedData = [...state.indexingProgressData];
            updatedData[existingIndex] = updatedItem;

            return { indexingProgressData: updatedData };
          }

          // Append new entry if not found
          return {
            indexingProgressData: [...state.indexingProgressData, newData],
          };
        });
      },
    }),
    {
      name: 'indexing-data-storage',
      storage: persistStorage,
    }
  )
);
