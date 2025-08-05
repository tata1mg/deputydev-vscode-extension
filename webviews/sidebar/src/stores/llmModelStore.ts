import { LLMModels } from '@/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { useChatStore } from './chatStore';

interface LLMModelStore {
  llmModels: LLMModels[];
  activeModel: string | null;
  setLLMModels: (models: LLMModels[]) => void;
  setActiveModel: (modelName: string) => void;
}

export const useLLMModelStore = create<LLMModelStore>()(
  persist(
    (set, get) => ({
      llmModels: [],
      activeModel: null,

      setLLMModels: (models) => {
        set({ llmModels: models });
        // If there's no active model yet, set the first one
        if (!get().activeModel && models.length) {
          set({ activeModel: models[0].name });
        }
      },

      setActiveModel: (modelName) => {
        set({ activeModel: modelName });
        const model = get().llmModels.find((m) => m.name === modelName);
        // If it's non-multimodal, clear s3Objects in chat store
        if (model && !model.multimodal) {
          useChatStore.setState({ s3Objects: [] });
        }
      },
    }),
    {
      name: 'llm-models-storage',
      storage: persistStorage,
    }
  )
);
