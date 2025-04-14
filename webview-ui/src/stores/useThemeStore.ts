import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { ThemeKind } from '@/types';

interface ThemeStore {
  themeKind: ThemeKind
  setThemeKind: (kind: ThemeStore['themeKind']) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      themeKind: 'dark', // default fallback
      setThemeKind: (kind) => set({ themeKind: kind }),
    }),
    {
      name: 'vscode-theme-storage',
      storage: persistStorage,
    }
  )
);
