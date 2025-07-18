import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { CodeReviewStorage, NewReview, ReviewOption } from '@/types';

export const useCodeReviewStore = create<CodeReviewStorage>()(
  persist(
    (set) => ({
      searchedBranches: [],
      selectedTargetBranch: '',
      new_review: {} as NewReview,
      activeReviewOption: { displayName: 'Review All Changes', value: 'ALL' } as ReviewOption,
      reviewOptions: [
        { displayName: 'Review All Changes', value: 'ALL' },
        { displayName: 'Review Uncommitted Changes', value: 'UNCOMMITTED_ONLY' },
        { displayName: 'Review Committed Changes', value: 'COMMITTED_ONLY' },
      ] as ReviewOption[],
      pastReviews: [],
      enabledAgents: [],
      userAgents: [],
      isFetchingChangedFiles: false,
      activeReviewId: 0,
      activeReviewSessionId: 0,
    }),
    {
      name: 'code-review-storage',
      storage: persistStorage,
    }
  )
);
