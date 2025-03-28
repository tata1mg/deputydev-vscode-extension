import { Session } from '@/types';
import { create } from 'zustand';

export const useSessionsStore = create<{
  sessions: Session[];
  sessionsPerPage: number;
  currentSessionsPage: number;
  setCurrentSessionsPage: (updater: (prev: number) => number) => void;
  setSessions: (sessions: Session[] | ((prevSessions: Session[]) => Session[])) => void; // Updated type
  clearSessions: () => void;
  clearCurrentSessionsPage: () => void;
}>()(
  (set) => ({
    sessions: [] as Session[],
    sessionsPerPage: 6,
    currentSessionsPage: 1,
    setCurrentSessionsPage: (updater) =>
      set((state) => ({ currentSessionsPage: updater(state.currentSessionsPage) })),
    setSessions: (sessions) =>
      set((state) => ({
        sessions: Array.isArray(sessions) ? sessions : sessions(state.sessions),
      })),
    clearSessions: () =>
      set({ sessions: [] }),
    clearCurrentSessionsPage: () =>
      set({ currentSessionsPage: 1 })
  })
);