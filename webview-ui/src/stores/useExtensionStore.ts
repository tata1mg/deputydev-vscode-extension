// file: webview-ui/src/stores/extensionStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ViewType } from '@/types';
import { useAuthStore } from './authStore';
import { persistStorage } from './lib'; // Ensure this utility is properly implemented

interface ExtensionState {
  isStarted: boolean;
  viewType: ViewType;
  clientVersion: string;
  setClientVersion: (clientVersion: string) => void;
  setViewType: (viewType: ViewType) => void;
  initializeViewType: () => void;
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      isStarted: false,
      viewType: 'loader',
      clientVersion: "",
      setClientVersion: (clientVersion: string) => set({clientVersion}),
      setViewType: (viewType: ViewType) => set({ viewType }),
      initializeViewType: () => {
        const { isAuthenticated } = useAuthStore.getState();
        const savedViewType = get().viewType;
        // console.log('current view type', savedViewType);
        if (isAuthenticated) {
          set({ viewType: savedViewType });
        }
      },
    }),
    {
      name: 'view-state-storage',
      storage: persistStorage,
    }
  )
);

// Ensure viewType initializes correctly on load
setTimeout(() => {
  const { isAuthenticated } = useAuthStore.getState();
  // console.log('isAuthenticated state at extension store', isAuthenticated);
  useExtensionStore.getState().initializeViewType();
}, 600);

export default useExtensionStore;
