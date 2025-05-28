import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib';
import { MCPStorage } from '@/types';

export const useMcpStore = create<MCPStorage>()(
  persist(
    (set) => ({
      mcpServerTools: [],
      mcpServers: [],
      selectedServer: undefined,
      showAllMCPServers: false,
      showMCPServerTools: false,
      setMcpServers: (mcpServers) => set({ mcpServers: mcpServers }),
    }),
    {
      name: 'mcp-storage',
      storage: persistStorage,
    }
  )
);
