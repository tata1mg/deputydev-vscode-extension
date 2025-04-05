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
import { Trash2, GripVertical, Pin, PinOff } from "lucide-react";
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

    const locale = "en-US";
    const datePart = date.toLocaleDateString(locale, dateOptions);
    const timePart = date.toLocaleTimeString(locale, timeOptions);

    return `${datePart}, ${timePart}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center gap-3 overflow-hidden rounded-lg p-3 shadow-md"
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

      <Trash2
        size={16}
        style={{
          color: "var(--vscode-icon-foreground)",
          cursor: "pointer",
          transition: "opacity 0.2s",
        }}
        className="flex-shrink-0 hover:opacity-70"
        onMouseDown={() => handleDeleteSession(session.id)}
      />

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
                Maximum 5 pinned conversations allowed, please unpin one to pin
                another.
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
    </div>
  );
};

export default function History() {
  const { sessions, sessionsPerPage, pinnedSessions } = useSessionsStore();
  const [sessionsLoading, setSessionsLoading] = useState(false);

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
    await deleteSession(sessionId);
  };

  const fetchSessions = async (pageNumber: number) => {
    setSessionsLoading(true);
    const limit = sessionsPerPage;
    const offset = (pageNumber - 1) * sessionsPerPage;
    getSessions(limit, offset);
    getPinnedSessions();
    setSessionsLoading(false);
  };

  useEffect(() => {
    fetchSessions(1);
  }, []);

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
      style={{
        height: "100vh",
        padding: "1rem",
        backgroundColor: "var(--vscode-sidebar-background-rgb)",
      }}
    >
      {sessions.length > 0 && (
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
              <div className="flex flex-col gap-2">
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

          <h3
            className="mb-2 mt-6 text-lg font-semibold"
            style={{ color: "var(--vscode-editor-foreground)" }}
          >
            Past Conversations
          </h3>
          <div className="hover:vscode-hover flex flex-col gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}
