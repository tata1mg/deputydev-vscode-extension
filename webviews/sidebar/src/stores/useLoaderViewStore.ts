import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';

export type LoaderPhase = 'idle' | 'starting' | 'downloading' | 'extracting' | 'finished';

export type LoaderViewStore = {
  loaderViewState: boolean;
  phase: LoaderPhase;
  progress: number;
  setLoaderViewState: (state: boolean) => void;
  setPhase: (phase: LoaderPhase) => void;
  setProgress: (progress: number) => void;
  reset: () => void;
};

export const useLoaderViewStore = create<LoaderViewStore>()(
  persist(
    (set) => ({
      loaderViewState: false,
      phase: 'idle',
      progress: 0,
      setLoaderViewState: (state) => set({ loaderViewState: state }),
      setPhase: (phase) => set({ phase }),
      setProgress: (progress) => set({ progress }),
      reset: () => set({ loaderViewState: false, phase: 'idle', progress: 0 }),
    }),
    {
      name: 'loader-view-state-storage',
      storage: persistStorage,
    }
  )
);
