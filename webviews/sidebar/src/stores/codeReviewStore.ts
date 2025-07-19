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
    addStep: (step: Omit<ReviewStep, 'status'> & { status?: AgentStatus }) => void;
    updateOrAddStep: (step: Omit<ReviewStep, 'status'> & { status?: AgentStatus }) => void;
  }
>()(
  persist(
    (set, get) => ({
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
      steps: [],

      setSteps: (steps) => set({ steps }),

      addStep: (step) =>
        set((state) => ({
          steps: [...state.steps, { ...step, status: step.status || 'IN_PROGRESS' }],
        })),

      updateOrAddStep: (step) =>
        set((state) => {
          const existingStepIndex = state.steps.findIndex((s) => s.id === step.id);

          if (existingStepIndex >= 0) {
            // Update existing step
            const updatedSteps = [...state.steps];
            updatedSteps[existingStepIndex] = {
              ...updatedSteps[existingStepIndex],
              ...step,
              status: step.status || updatedSteps[existingStepIndex].status,
              agents: step.agents || updatedSteps[existingStepIndex].agents,
            };
            return { steps: updatedSteps };
          } else {
            // Add new step
            return {
              steps: [...state.steps, { ...step, status: step.status || 'IN_PROGRESS' }],
            };
          }
        }),

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
    }),
    {
      name: 'code-review-storage',
      storage: persistStorage,
    }
  )
);
