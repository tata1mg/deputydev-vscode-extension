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
            task: 'INDEXING',
            status: 'IDLE' as ProgressStatus,
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
            // Keep the partial state update logic the same
            return {
              indexingProgressData: state.indexingProgressData.map((item) => {
                if (item.repo_path === newData.repo_path) {
                  const updatedFiles = new Map(
                    newData.indexing_status?.map((file) => [file.file_path, file.status])
                  );

                  const updatedIndexingStatus =
                    item.indexing_status?.map((file) => ({
                      ...file,
                      status: updatedFiles.get(file.file_path) ?? file.status,
                    })) ?? [];

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

          // Modified: Just update in place or append to the end
          const existingIndex = state.indexingProgressData.findIndex(
            (item) => item.repo_path === newData.repo_path
          );

          if (existingIndex >= 0) {
            // Update in place
            const updatedData = [...state.indexingProgressData];
            updatedData[existingIndex] = newData;
            return {
              indexingProgressData: updatedData,
            };
          } else {
            // Append to the end
            return {
              indexingProgressData: [...state.indexingProgressData, newData],
            };
          }
        });
      },
      updateOrAppendEmbeddingData: (newData) => {
        set((state) => {
          const existingIndex = state.embeddingProgressData.findIndex(
            (item) => item.repo_path === newData.repo_path
          );

          if (existingIndex >= 0) {
            // Update in place
            const updatedData = [...state.embeddingProgressData];
            updatedData[existingIndex] = newData;
            return {
              embeddingProgressData: updatedData,
            };
          } else {
            // Append to the end
            return {
              embeddingProgressData: [...state.embeddingProgressData, newData],
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
