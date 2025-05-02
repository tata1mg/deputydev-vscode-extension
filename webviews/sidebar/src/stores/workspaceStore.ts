import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { setWorkspaceState } from '@/commandApi';
import { WorkspaceStore } from '@/types';

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      workspaceRepos: [],
      activeRepo: null,
      setWorkspaceRepos: (repos, activeRepo) => set({ workspaceRepos: repos, activeRepo }),
      setActiveRepo: (repoPath) =>
        set((state) => ({
          activeRepo: repoPath,
          workspaceRepos: state.workspaceRepos,
        })),
    }),
    {
      name: 'workspace-storage',
      storage: persistStorage,
    }
  )
);
