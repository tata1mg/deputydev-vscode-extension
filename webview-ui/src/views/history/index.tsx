import { useSessionsStore } from "@/stores/sessionsStore";
import {
  deleteSession,
  getSessionChats,
  getSessions,
} from "@/commandApi";
import { useEffect, useState } from "react";
import { EllipsisVertical } from "lucide-react";

export default function History() {
  const { sessions, sessionsPerPage, setCurrentSessionsPage, currentSessionsPage } = useSessionsStore();
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const handleGetSessionChats = async (sessionId: number) => {
    getSessionChats(sessionId);
  };

  const handleDeleteSession = async (sessionId: number) => {
    useSessionsStore.setState({
      sessions: useSessionsStore
        .getState()
        .sessions.filter((session) => session.id !== sessionId),
    });
    await deleteSession(sessionId);
  };

  const fetchSessions = async (pageNumber: number) => {
    setSessionsLoading(true);
    const limit = sessionsPerPage;
    const offset = (pageNumber - 1) * sessionsPerPage;
    getSessions(limit, offset);
    setSessionsLoading(false);
  };
  useEffect(() => {
    fetchSessions(1);
  }, []);

  // Scroll handler for past sessions
  const handleSessionsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if ((scrollTop + clientHeight) > (scrollHeight - 5) && !sessionsLoading) {
      setCurrentSessionsPage((prev) => prev + 1);
      fetchSessions(currentSessionsPage + 1);
    }
  };

  return (
    <div className="h-full">
      {sessions.length > 0 && (
        <div>
          <div>
            <h3 className="mt-4 px-4 text-lg font-bold">
              Pinned Past Conversations
            </h3>
            <div className="session-box overflow-y-auto pl-4 pr-2 h-[200px]">
              {sessions.slice(0, 5).map((session) => (
                <div className="flex gap-2" key={session.id}>
                  <div
                    onClick={() => handleGetSessionChats(session.id)}
                    className="session-title mb-3 flex w-[84%] transform justify-between gap-1 rounded border border-gray-500/10 bg-gray-500/20 p-1 opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100"
                  >
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                      {session.summary}
                    </div>
                    <span className="mt-1 text-xs">
                      {session.age}
                    </span>
                  </div>
                  <EllipsisVertical
                    className="m-1 transform text-xs opacity-50 transition-transform hover:cursor-pointer hover:opacity-70"
                    onClick={() => {
                      handleDeleteSession(session.id);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mt-4 px-4 text-lg font-bold">
              Past Conversations
            </h3>
            <div
              className="session-box overflow-y-auto pl-4 pr-2 h-[300px]"
              onScroll={handleSessionsScroll}
            >
              {sessions.map((session) => (
                <div className="flex gap-2" key={session.id}>
                  <div
                    onClick={() => handleGetSessionChats(session.id)}
                    className="session-title mb-3 flex w-[84%] transform justify-between gap-1 rounded border border-gray-500/10 bg-gray-500/20 p-1 opacity-70 transition-transform hover:scale-105 hover:cursor-pointer hover:opacity-100"
                  >
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                      {session.summary}
                    </div>
                    <span className="mt-1 text-xs">
                      {session.age}
                    </span>
                  </div>
                  <EllipsisVertical
                    className="m-1 transform text-xs opacity-50 transition-transform hover:cursor-pointer hover:opacity-70"
                    onClick={() => {
                      handleDeleteSession(session.id);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
