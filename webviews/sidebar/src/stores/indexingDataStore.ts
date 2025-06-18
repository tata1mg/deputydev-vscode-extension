import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import {
  EmbeddingProgressData,
  IndexingDataStorage,
  IndexingProgressData,
  ProgressStatus,
} from '@/types';

export const useIndexingStore = create<
  IndexingDataStorage & {
    initializeRepos: (repoPaths: { repoPath: string }[]) => void;
    updateOrAppendIndexingData: (data: IndexingProgressData) => void;
    updateOrAppendEmbeddingData: (data: EmbeddingProgressData) => void;
  }
>()(
  persist(
    (set, get) => ({
      indexingProgressData: [],
      embeddingProgressData: [],
      initializeRepos: (repoPaths) => {
        const currentData = get().indexingProgressData;
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
            indexingProgressData: [...state.indexingProgressData, ...newRepos],
          }));
        }
      },
      updateOrAppendIndexingData: (newData) => {
        set((state) => {
          if (newData.is_partial_state) {
            // Handle partial state update
            return {
              indexingProgressData: state.indexingProgressData.map((item) => {
                if (item.repo_path === newData.repo_path) {
                  // Create a map of updated file statuses for quick lookup
                  const updatedFiles = new Map(
                    newData.indexing_status?.map((file) => [file.file_path, file.status])
                  );

                  // Update only the files that are in the partial update
                  const updatedIndexingStatus =
                    item.indexing_status?.map((file) => ({
                      ...file,
                      status: updatedFiles.get(file.file_path) ?? file.status,
                    })) ?? [];

                  // Add any new files that weren't in the original status
                  const newFiles = (newData.indexing_status || []).filter(
                    (file) => !item.indexing_status?.some((f) => f.file_path === file.file_path)
                  );

                  return {
                    ...item,
                    ...newData,
                    indexing_status: [...updatedIndexingStatus, ...newFiles],
                  };
                }
                return item;
              }),
            };
          }

          // Handle full state update (existing logic)
          const existingIndex = state.indexingProgressData.findIndex(
            (item) => item.repo_path === newData.repo_path
          );

          if (existingIndex >= 0) {
            // Remove the existing item and add the updated one at the beginning
            const updatedData = state.indexingProgressData.filter(
              (_, index) => index !== existingIndex
            );
            return {
              indexingProgressData: [newData, ...updatedData],
            };
          } else {
            // Add new entry at the beginning
            return {
              indexingProgressData: [newData, ...state.indexingProgressData],
            };
          }
        });
      },
      updateOrAppendEmbeddingData: (newData) => {
        set((state) => {
          // Handle full state update (existing logic)
          const existingIndex = state.embeddingProgressData.findIndex(
            (item) => item.repo_path === newData.repo_path
          );

          if (existingIndex >= 0) {
            // Remove the existing item and add the updated one at the beginning
            const updatedData = state.embeddingProgressData.filter(
              (_, index) => index !== existingIndex
            );
            return {
              embeddingProgressData: [newData, ...updatedData],
            };
          } else {
            // Add new entry at the beginning
            return {
              embeddingProgressData: [newData, ...state.embeddingProgressData],
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
