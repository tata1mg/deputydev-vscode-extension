import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';

interface ActiveFileStore {
  activeFileUri?: string;
  startLine?: number;
  endLine?: number;
  disableActiveFile: boolean;

  /* actions */
  setActiveFile: (uri?: string, start?: number, end?: number) => void;
  setDisableActiveFile: (disabled: boolean) => void; // <--- add this!
  toggleDisableActiveFile: () => void; // <--- optional, but convenient
}

export const useActiveFileStore = create<ActiveFileStore>()(
  persist(
    (set, get) => ({
      activeFileUri: undefined,
      startLine: undefined,
      endLine: undefined,
      disableActiveFile: false,

      setActiveFile: (uri, start, end) =>
        set({ activeFileUri: uri, startLine: start, endLine: end }),
      setDisableActiveFile: (disabled) => set({ disableActiveFile: disabled }),
      toggleDisableActiveFile: () => set({ disableActiveFile: !get().disableActiveFile }),
    }),
    {
      name: 'active-file-store',
      storage: persistStorage,
    }
  )
);
