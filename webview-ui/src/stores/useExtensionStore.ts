import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { ViewType } from '@/types';

const useExtensionStore = create(
  combine(
    {
      isStarted: false,
      viewType: 'loader' as ViewType, // changed welcome to chat  as default
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
