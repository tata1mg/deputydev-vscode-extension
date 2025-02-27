// file: webview-ui/src/stores/workspaceStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { setWorkspaceState} from '@/commandApi'

export type WorkspaceRepo = {
  repoPath: string;
  repoName: string;
};

interface WorkspaceStore {
  workspaceRepos: WorkspaceRepo[];
  activeRepo: string | null;
  setWorkspaceRepos: (repos: WorkspaceRepo[], activeRepo: string | null) => void;
  setActiveRepo: (repoPath: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      workspaceRepos: [],
      activeRepo: null,
      setWorkspaceRepos: (repos, activeRepo) =>
        set({ workspaceRepos: repos, activeRepo }),
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


