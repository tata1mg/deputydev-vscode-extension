import { useSessionsStore } from "@/stores/sessionsStore";
import {
  deleteSession,
  getSessionChats,
  getSessions,
  getPinnedSessions,
  reorderPinnedSessions,
  pinUnpinSession,
} from "@/commandApi";
import { use, useEffect, useState } from "react";
import { Trash2, GripVertical, Pin, PinOff, ArrowDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Session } from "@/types";

type SortableItemProps = {
  session: {
    id: number;
    summary: string;
    age: string;
    updated_at: string;
  };
  handleGetSessionChats: (sessionId: number) => void;
  handleDeleteSession: (sessionId: number) => void;
  handlePinUnpinSession: (
    session: Session,
    pin_or_unpin: "PINNED" | "UNPINNED",
  ) => void;
  isPinned: boolean;
  disablePinning?: boolean;
};

const SortableItem: React.FC<SortableItemProps> = ({
  session,
  handleGetSessionChats,
  handleDeleteSession,
  isPinned,
  disablePinning,
  handlePinUnpinSession,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: session.id,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: "1px solid var(--vscode-editor-border)",
    backgroundColor: "var(--vscode-editor-background)",
  };

  const getLocaleTimeString = (dateString: string) => {
    const date = new Date(dateString);
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    };
    console.log(navigator.language);
    const locale = navigator.language || "en-US";
    const datePart = date.toLocaleDateString(locale, dateOptions);
    const timePart = date.toLocaleTimeString(locale, timeOptions);

    return `${datePart}, ${timePart}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center gap-3 overflow-visible rounded-lg p-3 shadow-md"
    >
      <div
        onClick={() => handleGetSessionChats(session.id)}
        className="flex w-full cursor-pointer items-start justify-between gap-2 overflow-hidden"
      >
        {isPinned ? (
          <div
            className="flex items-center self-stretch"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            {...listeners}
          >
            <GripVertical size={16} />
          </div>
        ) : null}
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className="text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--vscode-descriptionForeground)" }}
                >
                  {getLocaleTimeString(session.updated_at)}
                </div>
                <div
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium"
                  style={{ color: "var(--vscode-editor-foreground)" }}
                >
                  {session.summary}
                </div>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                className="max-w-[300px] break-words rounded-md px-2 py-1 shadow-md"
                style={{
                  backgroundColor: "var(--vscode-editorHoverWidget-background)",
                  color: "var(--vscode-editorHoverWidget-foreground)",
                  border: "1px solid var(--vscode-editorHoverWidget-border)",
                }}
              >
                {session.summary}
                <Tooltip.Arrow
                  style={{ fill: "var(--vscode-editorHoverWidget-background)" }}
                />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      {isPinned ? (
        <PinOff
          size={16}
          style={{
            color: "var(--vscode-icon-foreground)",
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
          className="flex-shrink-0 hover:opacity-70"
          onMouseDown={() => handlePinUnpinSession(session, "UNPINNED")}
        />
      ) : disablePinning ? (
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div>
                <Pin
                  size={16}
                  style={{
                    color: "var(--vscode-icon-foreground)",
                    cursor: "not-allowed",
                    opacity: 0.5,
                  }}
                  className="flex-shrink-0"
                />
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                className="max-w-[300px] break-words rounded-md px-2 py-1 shadow-md"
                style={{
                  backgroundColor: "var(--vscode-editorHoverWidget-background)",
                  color: "var(--vscode-editorHoverWidget-foreground)",
                  border: "1px solid var(--vscode-editorHoverWidget-border)",
                }}
              >
                Maximum 5 pinned conversations allowed
                <Tooltip.Arrow
                  style={{ fill: "var(--vscode-editorHoverWidget-background)" }}
                />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ) : (
        <Pin
          size={16}
          style={{
            color: "var(--vscode-icon-foreground)",
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
          className="flex-shrink-0 hover:opacity-70"
          onMouseDown={() => handlePinUnpinSession(session, "PINNED")}
        />
      )}
      <div className="relative flex-shrink-0">
        {!showDeleteConfirm ? (
          <Trash2
            size={16}
            style={{
              color: "var(--vscode-icon-foreground)",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            className="hover:opacity-70"
            onMouseDown={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
          />
        ) : (
          <div
            className="absolute bottom-full right-0 z-10 mb-2 flex min-w-[180px] animate-[fadeInSlideUp_0.2s_ease-out] flex-col gap-2 rounded-sm border p-3 shadow-md"
            style={{
              backgroundColor: "var(--vscode-editorHoverWidget-background)",
              borderColor: "var(--vscode-editorHoverWidget-border)",
            }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--vscode-editorHoverWidget-foreground)" }}
            >
              Are you sure you want to delete this session?
            </span>
            <div className="mt-1 flex justify-end gap-2">
              <button
                className="rounded-sm px-2 py-0.5 text-xs focus:outline focus:outline-offset-1"
                style={{
                  color: "var(--vscode-button-foreground)",
                  backgroundColor: "var(--vscode-button-background)",
                  border: "1px solid var(--vscode-button-border)",
                  outlineColor: "var(--vscode-focusBorder)",
                }}
                onMouseDown={() => {
                  handleDeleteSession(session.id);
                  setShowDeleteConfirm(false);
                }}
              >
                Yes
              </button>
              <button
                className="rounded-sm px-2 py-0.5 text-xs focus:outline focus:outline-offset-1"
                style={{
                  color: "var(--vscode-button-secondaryForeground)",
                  backgroundColor: "var(--vscode-button-secondaryBackground)",
                  border: "1px solid var(--vscode-button-secondaryBorder)",
                  outlineColor: "var(--vscode-focusBorder)",
                }}
                onMouseDown={() => setShowDeleteConfirm(false)}
              >
                No
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function History() {
  const { sessions, sessionsPerPage, pinnedSessions, currentSessionsPage, setCurrentSessionsPage } = useSessionsStore();
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [disableLoader, setDisableLoader] = useState(false);
  const [noActiveSessionsMessage, setNoActiveSessionsMessage] = useState("Loading your DeputyDev sessions history...");

  const handleGetSessionChats = async (sessionId: number) => {
    getSessionChats(sessionId);
  };

  const handlePinUnpinSession = async (
    session: Session,
    pin_or_unpin: "PINNED" | "UNPINNED",
    rank?: number,
  ) => {
    if (pin_or_unpin === "PINNED") {
      const pinnedSessionsCount =
        useSessionsStore.getState().pinnedSessions.length;
      if (pinnedSessionsCount >= 5) {
        alert(
          "Maximum 5 pinned conversations allowed, please unpin one to pin another.",
        );
        return;
      }
      const updatedPinnedSessions = [...pinnedSessions, session];
      pinUnpinSession(session.id, "PINNED", pinnedSessionsCount);
      useSessionsStore.setState({ pinnedSessions: updatedPinnedSessions });
      useSessionsStore.setState({
        sessions: useSessionsStore
          .getState()
          .sessions.filter((s) => s.id !== session.id),
      });
    } else {
      const updatedPinnedSessions = pinnedSessions.filter(
        (pinnedSession) => pinnedSession.id !== session.id,
      );
      pinUnpinSession(session.id, "UNPINNED");
      useSessionsStore.setState({ pinnedSessions: updatedPinnedSessions });
      useSessionsStore.setState({
        sessions: [...useSessionsStore.getState().sessions, session],
      });
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    useSessionsStore.setState({
      sessions: useSessionsStore
        .getState()
        .sessions.filter((session) => session.id !== sessionId),
    });
    useSessionsStore.setState({
      pinnedSessions: useSessionsStore
        .getState()
        .pinnedSessions.filter((session) => session.id !== sessionId),
    });
    await deleteSession(sessionId);
  };

  const fetchSessions = async (pageNumber: number) => {
    setSessionsLoading(true);
    const limit = sessionsPerPage;
    const offset = (pageNumber - 1) * sessionsPerPage;
    getSessions(limit, offset);
    setSessionsLoading(false);
    setCurrentSessionsPage(prev => prev + 1);
  };

  useEffect(() => {
    getPinnedSessions();
    if (sessions.length === 0) {
      fetchSessions(1);
    }
  }, []);

  useEffect(() => {
    const checkActiveSessions = async () => {
      await new Promise(resolve => setTimeout(resolve, 4000));

      if (pinnedSessions.length === 0 && sessions.length === 0) {
        setNoActiveSessionsMessage("Your session history will appear here once you begin your AI development journey with DeputyDev");
        setDisableLoader(true);
      }
    };

    checkActiveSessions();
  }, [sessions, pinnedSessions]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pinnedSessions.findIndex(
      (session) => session.id === active.id,
    );
    const newIndex = pinnedSessions.findIndex(
      (session) => session.id === over.id,
    );

    const reorderedSessions = arrayMove(pinnedSessions, oldIndex, newIndex);
    const updatedSessions = reorderedSessions.map((session, index) => ({
      ...session,
      order: index,
    }));
    const updatedSessionsRequest = {} as Record<number, number>;
    for (let i = 0; i < updatedSessions.length; i++) {
      updatedSessionsRequest[updatedSessions[i].id] = i;
    }
    reorderPinnedSessions(updatedSessionsRequest);
    useSessionsStore.setState({
      pinnedSessions: updatedSessions,
    });
  };

  return (
    <div
      className="h-full"
      style={{
        padding: "1rem",
        backgroundColor: "var(--vscode-sidebar-background-rgb)",
      }}
    >
      {noActiveSessionsMessage && sessions.length === 0 && pinnedSessions.length === 0 && (
        <div className="flex flex-col justify-center items-center mt-[250px]">
          {!disableLoader &&
            <div
              className="animate-spin inline-block w-16 h-16 border-4 border-current border-t-transparent rounded-full"
              role="status"
              aria-label="loading"
            />
          }
          <div
            className="mt-[10px] text-gray-500 text-center"
          >
            {noActiveSessionsMessage}
          </div>
        </div>
      )}

      {/* Pinned Sessions container */}
      {pinnedSessions.length > 0 && (
        <div>
          <h3
            className="mb-2 text-lg font-semibold"
            style={{ color: "var(--vscode-editor-foreground)" }}
          >
            Pinned Conversations
          </h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pinnedSessions}
              strategy={verticalListSortingStrategy}
            >
              <div className="relative flex flex-col gap-2 overflow-visible">
                {pinnedSessions.map((session) => (
                  <SortableItem
                    key={session.id}
                    session={session}
                    handleGetSessionChats={handleGetSessionChats}
                    handleDeleteSession={handleDeleteSession}
                    isPinned={true}
                    handlePinUnpinSession={handlePinUnpinSession}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Unpinned Sessions container */}
      {sessions.length > 0 && (
        <div>
          <h3
            className="mb-2 mt-6 text-lg font-semibold"
            style={{ color: "var(--vscode-editor-foreground)" }}
          >
            Past Conversations
          </h3>
          <div className="hover:vscode-hover flex flex-col gap-2 h-[350px] overflow-y-auto">
            {sessions.map((session) => (
              <SortableItem
                key={session.id}
                session={session}
                handleGetSessionChats={handleGetSessionChats}
                handleDeleteSession={handleDeleteSession}
                isPinned={false}
                disablePinning={pinnedSessions.length >= 5}
                handlePinUnpinSession={handlePinUnpinSession}
              />
            ))}
            <div className="mt-2 animate-bounce flex justify-center cursor-pointer" onClick={() => fetchSessions(currentSessionsPage)}>
              <ArrowDown />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
