import { create } from 'zustand';
import { combine } from 'zustand/middleware';

export type ViewType = 'chat' | 'setting' | 'welcome' | 'history' | 'auth';

const useExtensionStore = create(
  combine(
    {
      isStarted: false,
      viewType: 'chat' as ViewType, // changed welcome to chat  as default
      serverUrl:
        import.meta.env.NODE_ENV === 'development'
          ? 'http://localhost:5000'
          : '',
      errorMessage: '',
    },
    (set) => ({
      setViewType: (viewType: ViewType) => set({ viewType }),
    }),
  ),
);

export default useExtensionStore;
