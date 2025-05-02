// file: webview-ui/src/stores/workspaceStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';

type LoaderViewStore = {
  loaderViewState: boolean;
  setLoaderViewState: (state: boolean) => void;
};

export const useLoaderViewStore = create<LoaderViewStore>()(
  persist(
    (set) => ({
      loaderViewState: false,
      setLoaderViewState: (state) => set({ loaderViewState: state }),
    }),
    {
      name: 'loader-view-state-storage',
      storage: persistStorage,
    }
  )
);
