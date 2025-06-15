import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { IndexingDataStorage, IndexingProgressData, ProgressStatus } from '@/types';

export const useIndexingStore = create<
  IndexingDataStorage & {
    initializeRepos: (repoPaths: { repoPath: string }[]) => void;
    updateOrAppendIndexingData: (data: IndexingProgressData) => void;
  }
>()(
  persist(
    (set, get) => ({
      IndexingProgressData: [],
      initializeRepos: (repoPaths) => {
        const currentData = get().IndexingProgressData;
        const existingPaths = new Set(currentData.map((item) => item.repo_path));

        const newRepos = repoPaths
          .filter((repo) => !existingPaths.has(repo.repoPath))
          .map((repo) => ({
            task: 'Indexing',
            status: 'Idle' as ProgressStatus,
            repo_path: repo.repoPath,
            progress: 0,
            indexing_status: [],
            is_partial_state: false,
          }));

        if (newRepos.length > 0) {
          set((state) => ({
            IndexingProgressData: [...state.IndexingProgressData, ...newRepos],
          }));
        }
      },
      updateOrAppendIndexingData: (newData) => {
        set((state) => {
          const existingIndex = state.IndexingProgressData.findIndex(
            (item) => item.repo_path === newData.repo_path
          );

          if (existingIndex >= 0) {
            // Remove the existing item and add the updated one at the beginning
            const updatedData = state.IndexingProgressData.filter(
              (_, index) => index !== existingIndex
            );
            return {
              IndexingProgressData: [newData, ...updatedData],
            };
          } else {
            // Add new entry at the beginning
            return {
              IndexingProgressData: [newData, ...state.IndexingProgressData],
            };
          }
        });
      },
    }),
    {
      name: 'indexing-data-storage',
      storage: persistStorage,
    }
  )
);
