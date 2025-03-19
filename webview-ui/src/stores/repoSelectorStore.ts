import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';

interface RepoSelectorStore {
  repoSelectorDisabled: boolean;
  setRepoSelectorDisabled: (disabled: boolean) => void;
}

export const useRepoSelectorStore = create<RepoSelectorStore>()(
  persist(
    (set) => ({
      repoSelectorDisabled: false,
      setRepoSelectorDisabled: (disabled: boolean) => set({ repoSelectorDisabled: disabled }),
    }),
    {
      name: 'repo-selector-storage',
      storage: persistStorage,
    }
  )
);
