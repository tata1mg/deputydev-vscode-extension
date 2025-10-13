import { LLMModels, ReasoningLevel } from '@/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { useChatStore } from './chatStore';

interface LLMModelStore {
  llmModels: LLMModels[];
  activeModel: LLMModels | null;
  setLLMModels: (models: LLMModels[]) => void;
  setActiveModel: (modelName: string | null) => void;
  setActiveReasoning: (level: ReasoningLevel) => void;
  getActiveReasoning: () => ReasoningLevel | null;
}

export const useLLMModelStore = create<LLMModelStore>()(
  persist(
    (set, get) => ({
      llmModels: [],
      activeModel: null,

      setLLMModels: (incoming) => {
        const prev = get().llmModels;

        // Preserve previously selected reasoning per model (if still supported)
        const prevSelectedByName = new Map<string, ReasoningLevel>();
        for (const m of prev) {
          if (m.reasoning?.default) prevSelectedByName.set(m.name, m.reasoning.default);
        }

        const merged: LLMModels[] = incoming.map((m) => {
          if (!m.reasoning) return m;
          const prevSelected = prevSelectedByName.get(m.name);
          if (prevSelected && m.reasoning.supported.includes(prevSelected)) {
            return {
              ...m,
              reasoning: { ...m.reasoning, default: prevSelected },
            };
          }
          return m;
        });

        set({ llmModels: merged });

        const current = get().activeModel;

        if (!current && merged.length) {
          // First-time setup → pick first model (with merged reasoning)
          set({ activeModel: merged[0] });
        } else if (typeof current === 'string') {
          // Migration (old persisted shape)
          const found = merged.find((m) => m.name === current);
          set({ activeModel: found ?? merged[0] ?? null });
        } else if (current) {
          // Rebind activeModel to the merged reference (keeps reasoning in sync)
          const found = merged.find((m) => m.name === current.name);
          if (found) set({ activeModel: found });
          else set({ activeModel: merged[0] ?? null });
        }
      },

      setActiveModel: (modelName) => {
        set((state) => {
          const targetName = modelName ?? state.activeModel?.name ?? null;
          const model = state.llmModels.find((m) => m.name === targetName) ?? null;

          if (model && !model.multimodal) {
            useChatStore.getState().updateCurrentChat({ s3Objects: [] });
          }

          return { activeModel: model };
        });
      },

      setActiveReasoning: (level) => {
        const current = get().activeModel;
        if (!current?.reasoning) return;

        // Update activeModel
        const updatedActive: LLMModels = {
          ...current,
          reasoning: { ...current.reasoning, default: level },
        };

        // Update llmModels entry so it persists across switches/reloads
        const updatedList = get().llmModels.map((m) =>
          m.name === updatedActive.name
            ? { ...m, reasoning: { ...m.reasoning!, default: level } }
            : m
        );

        set({ activeModel: updatedActive, llmModels: updatedList });
      },

      getActiveReasoning: () => {
        const current = get().activeModel;
        return current?.reasoning?.default ?? null;
      },
    }),
    {
      name: 'llm-models-storage',
      storage: persistStorage,
    }
  )
);
