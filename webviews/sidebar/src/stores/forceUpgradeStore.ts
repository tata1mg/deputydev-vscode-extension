import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
interface ForceUpgradeData {
  url: string;
  upgradeVersion: string;
  currentVersion: string;
}
interface ForceUpgradeStore {
  showForceUpgrade: boolean;
  setShowForceUpgrade: (value: boolean) => void;
  forceUpgradeData: ForceUpgradeData;
  setForceUpgradeData: (data: ForceUpgradeData) => void;
}

export const useForceUpgradeStore = create<ForceUpgradeStore>()(
  persist(
    (set) => ({
      showForceUpgrade: false,
      setShowForceUpgrade: (value) => set({ showForceUpgrade: value }),
      forceUpgradeData: {
        url: '',
        upgradeVersion: '',
        currentVersion: '',
      },
      setForceUpgradeData: (data) => set({ forceUpgradeData: data }),
    }),
    {
      name: 'force-upgrade-storage',
      storage: persistStorage,
    }
  )
);
