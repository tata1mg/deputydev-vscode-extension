
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';

interface ForceUpgradeStore {
    showForceUpgrade: boolean;
    setShowForceUpgrade: (value: boolean) => void;
}

export const useForceUpgradeStore = create<ForceUpgradeStore>()(
  persist(
    (set) => ({
        showForceUpgrade: false,
        setShowForceUpgrade: (value) => set({ showForceUpgrade: value }),
    }),
    {
      name: 'force-upgrade-storage',
      storage: persistStorage,
    }
  )
);
