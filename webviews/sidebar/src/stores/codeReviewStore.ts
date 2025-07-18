import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { AgentStatus, CodeReviewStorage, NewReview, ReviewOption, ReviewStep } from '@/types';

export const useCodeReviewStore = create<
  CodeReviewStorage & {
    steps: ReviewStep[];
    setSteps: (steps: ReviewStep[]) => void;
    updateStepStatus: (stepId: string, status: AgentStatus) => void;
    updateAgentStatus: (stepId: string, agentId: number, status: AgentStatus) => void;
  }
>()(
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
      steps: [
        {
          id: 'setup',
          label: 'Setting up review',
          status: 'PENDING',
        },
        {
          id: 'reviewing',
          label: 'Reviewing files',
          status: 'PENDING',
          agents: [
            { id: 1, name: 'Security', status: 'PENDING' },
            { id: 2, name: 'Performance', status: 'PENDING' },
          ],
        },
        {
          id: 'finalyzing',
          label: 'Finalizing Review',
          status: 'PENDING',
        },
      ],
      setSteps: (steps) => set({ steps }),
      updateStepStatus: (stepId, status) =>
        set((state) => ({
          steps: state.steps.map((step) => (step.id === stepId ? { ...step, status } : step)),
        })),
      updateAgentStatus: (stepId, agentId, status) =>
        set((state) => ({
          steps: state.steps.map((step) =>
            step.id === stepId && step.agents
              ? {
                  ...step,
                  agents: step.agents.map((agent) =>
                    agent.id === agentId ? { ...agent, status } : agent
                  ),
                }
              : step
          ),
        })),
      async startCodeReview() {},
    }),
    {
      name: 'code-review-storage',
      storage: persistStorage,
    }
  )
);
