import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistStorage } from "./lib";

type ChatType = "ask" | "write";

interface SettingsStore {
  terminalOutputLimit: number;
  shellIntegrationTimeout: number;
  shellCommandTimeout: number;
  isYoloModeOn: boolean;
  commandsToDeny: string[];
  chatType: ChatType;

  setTerminalOutputLimit: (value: number) => void;
  setShellIntegrationTimeout: (value: number) => void;
  setShellCommandTimeout: (value: number) => void;
  setIsYoloModeOn: (value: boolean) => void;
  setCommandsToDeny: (value: string[]) => void;
  setChatType: (value: ChatType) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      terminalOutputLimit: 1000,
      shellIntegrationTimeout: 30,
      shellCommandTimeout: 60,
      isYoloModeOn: false,
      commandsToDeny: ["rm -rf"],
      chatType: "ask",

      setTerminalOutputLimit: (value) => set({ terminalOutputLimit: value }),
      setShellIntegrationTimeout: (value) =>
        set({ shellIntegrationTimeout: value }),
      setShellCommandTimeout: (value) => set({ shellCommandTimeout: value }),
      setIsYoloModeOn: (value) => set({ isYoloModeOn: value }),
      setCommandsToDeny: (value) => set({ commandsToDeny: value }),
      setChatType: (value) => set({ chatType: value }),
    }),
    {
      name: "settings-storage",
      storage: persistStorage,
    },
  ),
);
