import { Session } from "@/types";
import { create } from "zustand";

export const useSessionsStore = create<{
  sessions: Session[];
  pinnedSessions: Session[];
  sessionsPerPage: number;
  currentSessionsPage: number;
  hasMore: boolean;
  noUnpinnedSessions: boolean;
  noPinnedSessions: boolean;
  loadingPinnedSessions: boolean;
  loadingUnpinnedSessions: boolean;
  setCurrentSessionsPage: (updater: (prev: number) => number) => void;
  setSessions: (
    sessions: Session[] | ((prevSessions: Session[]) => Session[]),
  ) => void;
  setPinnedSessions: (
    sessions: Session[] | ((prevSessions: Session[]) => Session[]),
  ) => void; // Setter
  setHasMore: (value: boolean) => void;
  clearSessions: () => void;
  clearPinnedSessions: () => void;
  clearCurrentSessionsPage: () => void;
}>()((set) => ({
  loadingPinnedSessions: true,
  loadingUnpinnedSessions: true,
  sessions: [] as Session[],
  pinnedSessions: [] as Session[],
  sessionsPerPage: 20,
  currentSessionsPage: 1,
  hasMore: true,
  noUnpinnedSessions: false,
  noPinnedSessions: false,
  setCurrentSessionsPage: (updater) =>
    set((state) => ({
      currentSessionsPage: updater(state.currentSessionsPage),
    })),
  setSessions: (sessions) =>
    set((state) => ({
      sessions: Array.isArray(sessions) ? sessions : sessions(state.sessions),
    })),
  setPinnedSessions: (sessions) =>
    set((state) => ({
      pinnedSessions: Array.isArray(sessions)
        ? sessions
        : sessions(state.pinnedSessions),
    })),
  setHasMore: (value: boolean) => set({hasMore: value}),
  clearSessions: () => set({ sessions: [] }),
  clearPinnedSessions: () => set({ pinnedSessions: [] }),
  clearCurrentSessionsPage: () => set({ currentSessionsPage: 1 }),
}));
