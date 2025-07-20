import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import {
  AgentStatus,
  CodeReviewSetting,
  CodeReviewStorage,
  NewReview,
  ReviewOption,
  ReviewStep,
} from '@/types';

export const useCodeReviewStore = create<
  CodeReviewStorage & {
    steps: ReviewStep[];
    failedAgents: Array<{ id: number; name: string }>;
    showFailedAgentsDialog: boolean;
    setSteps: (steps: ReviewStep[]) => void;
    updateStepStatus: (stepId: string, status: AgentStatus) => void;
    updateAgentStatus: (stepId: string, agentId: number, status: AgentStatus) => void;
    addStep: (step: Omit<ReviewStep, 'status'> & { status?: AgentStatus }) => void;
    updateOrAddStep: (step: Omit<ReviewStep, 'status'> & { status?: AgentStatus }) => void;
    setFailedAgents: (agents: Array<{ id: number; name: string }>) => void;
    setShowFailedAgentsDialog: (show: boolean) => void;
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
      userAgents: [],
      isFetchingChangedFiles: false,
      activeReviewId: 0,
      activeReviewSessionId: 0,
      steps: [],
      failedAgents: [],
      showFailedAgentsDialog: false,

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

      setFailedAgents: (agents) => set({ failedAgents: agents }),
      setShowFailedAgentsDialog: (show) => set({ showFailedAgentsDialog: show }),
    }),
    {
      name: 'code-review-storage',
      storage: persistStorage,
    }
  )
);

export const useCodeReviewSettingStore = create<CodeReviewSetting>()(
  persist(
    (set) => ({
      enabledAgents: [],
    }),
    {
      name: 'code-review-setting-store',
      storage: persistStorage,
    }
  )
);
