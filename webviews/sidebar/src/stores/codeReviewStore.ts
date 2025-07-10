import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { CodeReviewStorage, NewReview } from '@/types';

export const useCodeReviewStore = create<CodeReviewStorage>()(
  persist(
    (set) => ({
      new_review: {} as NewReview,
    }),
    {
      name: 'code-review-storage',
      storage: persistStorage,
    }
  )
);
