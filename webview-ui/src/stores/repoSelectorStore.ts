import { create } from 'zustand';

interface RepoSelectorStore {
  // If true, the repo selector is disabled.
  repoSelectorDisabled: boolean;
  setRepoSelectorDisabled: (disabled: boolean) => void;
}

export const useRepoSelectorStore = create<RepoSelectorStore>((set) => ({
  repoSelectorDisabled: false, // initial state: repo selector enabled
  setRepoSelectorDisabled: (disabled: boolean) =>
    set({ repoSelectorDisabled: disabled }),
}));
