import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { URLListItem } from '@/types';

type ChatType = 'ask' | 'write';

interface SettingsStore {
  terminalOutputLimit: number;
  shellIntegrationTimeout: number;
  shellCommandTimeout: number;
  isYoloModeOn: boolean;
  commandsToDeny: string[];
  disableShellIntegration: boolean;
  urls: URLListItem[];

  setTerminalOutputLimit: (value: number) => void;
  setShellIntegrationTimeout: (value: number) => void;
  setShellCommandTimeout: (value: number) => void;
  setIsYoloModeOn: (value: boolean) => void;
  setCommandsToDeny: (value: string[]) => void;
  setDisableShellIntegration: (value: boolean) => void;
  setUrls: (value: URLListItem[]) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      terminalOutputLimit: 500,
      shellIntegrationTimeout: 30,
      shellCommandTimeout: 10,
      isYoloModeOn: false,
      commandsToDeny: [],
      disableShellIntegration: false,
      urls: [] as URLListItem[],

      setTerminalOutputLimit: (value) => set({ terminalOutputLimit: value }),
      setShellIntegrationTimeout: (value) => set({ shellIntegrationTimeout: value }),
      setShellCommandTimeout: (value) => set({ shellCommandTimeout: value }),
      setIsYoloModeOn: (value) => set({ isYoloModeOn: value }),
      setCommandsToDeny: (value) => set({ commandsToDeny: value }),
      setDisableShellIntegration: (value) => set({ disableShellIntegration: value }),
      setUrls: (value: URLListItem[]) => set({ urls: value }),
    }),
    {
      name: 'settings-storage',
      storage: persistStorage,
    }
  )
);
