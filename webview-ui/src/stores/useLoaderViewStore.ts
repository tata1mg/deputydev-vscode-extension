// file: webview-ui/src/stores/workspaceStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';

type LoaderViewStore = {
  loaderViewState: string;
  setLoaderViewState: (state: string) => void;
};

export const useLoaderViewStore = create<LoaderViewStore>()(
  persist(
    (set) => ({
        loaderViewState: 'Initializing DeputyDev',
        setLoaderViewState: (state) => set({ loaderViewState: state }),
    }),
    {
      name: 'loader-view-state-storage',
      storage: persistStorage,
    }
  )
);
