import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { WorkspaceStore } from '@/types';

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      contextRepositories: [],
      workspaceRepos: [],
      activeRepo: null,
      setWorkspaceRepos: (repos, activeRepo) => set({ workspaceRepos: repos, activeRepo }),
      setActiveRepo: (repoPath) =>
        set((state) => {
          if (!repoPath) {
            repoPath = state.activeRepo;
          }
          const exists = state.workspaceRepos.some((repo) => repo.repoPath === repoPath);
          return {
            ...state,
            activeRepo: exists ? repoPath : null,
          };
        }),
    }),
    {
      name: 'workspace-storage',
      storage: persistStorage,
    }
  )
);
