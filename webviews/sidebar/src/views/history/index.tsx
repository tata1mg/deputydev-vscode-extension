import { useSessionsStore } from '@/stores/sessionsStore';
import {
  deleteSession,
  getSessionChats,
  getSessions,
  getPinnedSessions,
  reorderPinnedSessions,
  pinUnpinSession,
} from '@/commandApi';
import { useEffect, useState } from 'react';
import { Trash2, GripVertical, Pin, PinOff, ArrowDown } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChatMessage, Session } from '@/types';
import useExtensionStore from '@/stores/useExtensionStore';
import { useChatStore } from '@/stores/chatStore';

type SortableItemProps = {
  session: {
    id: number;
    summary: string;
    age: string;
    updated_at: string;
  };
  handleGetSessionChats: (sessionId: number) => void;
  handleDeleteSession: (sessionId: number) => void;
  handlePinUnpinSession: (session: Session, pin_or_unpin: 'PINNED' | 'UNPINNED') => void;
  isPinned: boolean;
  disablePinning?: boolean;
  mountPopupOnBottom?: boolean;
};

const SortableItem: React.FC<SortableItemProps> = ({
  session,
  handleGetSessionChats,
  handleDeleteSession,
  isPinned,
  disablePinning,
  handlePinUnpinSession,
  mountPopupOnBottom,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: '1px solid var(--vscode-editor-border)',
    backgroundColor: 'var(--vscode-editor-background)',
  };

  useEffect(() => {
    if (!showDeleteConfirm) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!e.target) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.delete-confirmation-popup')) {
        setShowDeleteConfirm(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDeleteConfirm]);
  const getLocaleTimeString = (dateString: string) => {
    const cleanedDateString = dateString.split('.')[0] + 'Z'; // Force UTC
    const date = new Date(cleanedDateString);
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    };

    const locale = navigator.language || 'en-US';
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
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  {getLocaleTimeString(session.updated_at)}
                </div>
                <div
                  className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium"
                  style={{ color: 'var(--vscode-editor-foreground)' }}
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
                  backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                  color: 'var(--vscode-editorHoverWidget-foreground)',
                  border: '1px solid var(--vscode-editorHoverWidget-border)',
                }}
              >
                {session.summary}
                <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      {isPinned ? (
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <PinOff
                size={16}
                style={{
                  color: 'var(--vscode-icon-foreground)',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                className="flex-shrink-0 hover:opacity-70"
                onMouseDown={() => handlePinUnpinSession(session, 'UNPINNED')}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                className="rounded-md px-2 py-1 text-xs shadow-md"
                style={{
                  backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                  color: 'var(--vscode-editorHoverWidget-foreground)',
                  border: '1px solid var(--vscode-editorHoverWidget-border)',
                }}
              >
                Unpin conversation
                <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ) : disablePinning ? (
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div>
                <Pin
                  size={16}
                  style={{
                    color: 'var(--vscode-icon-foreground)',
                    cursor: 'not-allowed',
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
                  backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                  color: 'var(--vscode-editorHoverWidget-foreground)',
                  border: '1px solid var(--vscode-editorHoverWidget-border)',
                }}
              >
                Maximum 5 pinned conversations allowed
                <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ) : (
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Pin
                size={16}
                style={{
                  color: 'var(--vscode-icon-foreground)',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                className="flex-shrink-0 hover:opacity-70"
                onMouseDown={() => handlePinUnpinSession(session, 'PINNED')}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                className="rounded-md px-2 py-1 text-xs shadow-md"
                style={{
                  backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                  color: 'var(--vscode-editorHoverWidget-foreground)',
                  border: '1px solid var(--vscode-editorHoverWidget-border)',
                }}
              >
                Pin conversation
                <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
      <div className="relative flex-shrink-0">
        {!showDeleteConfirm ? (
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Trash2
                  size={16}
                  style={{
                    color: 'var(--vscode-icon-foreground)',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  className="hover:opacity-70"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setTriggerRect(e.currentTarget.getBoundingClientRect());
                    setShowDeleteConfirm(true);
                  }}
                />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="top"
                  className="rounded-md px-2 py-1 text-xs shadow-md"
                  style={{
                    backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                    color: 'var(--vscode-editorHoverWidget-foreground)',
                    border: '1px solid var(--vscode-editorHoverWidget-border)',
                  }}
                >
                  Delete conversation
                  <Tooltip.Arrow
                    style={{
                      fill: 'var(--vscode-editorHoverWidget-background)',
                    }}
                  />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        ) : (
          <div
            className="fixed z-[9999] flex min-w-[180px] animate-[fadeInSlideDown_0.2s_ease-out] flex-col gap-2 rounded-sm border p-3 shadow-md"
            style={{
              backgroundColor: 'var(--vscode-editorHoverWidget-background)',
              borderColor: 'var(--vscode-editorHoverWidget-border)',
              marginRight: '20px',
              top: mountPopupOnBottom
                ? `calc(${triggerRect?.y || 0}px + 20px)`
                : `calc(${triggerRect?.y || 0}px - 100px)`,
              left: `calc(${triggerRect?.x || 0}px - 220px)`,
              maxWidth: 'calc(100vw - 32px)',
            }}
          >
            <span
              className="text-xs"
              style={{ color: 'var(--vscode-editorHoverWidget-foreground)' }}
            >
              Are you sure you want to delete this Conversation?
            </span>
            <div className="mt-1 flex justify-end gap-2">
              <button
                className="rounded-sm px-2 py-0.5 text-xs focus:outline focus:outline-offset-1"
                style={{
                  color: 'var(--vscode-button-foreground)',
                  backgroundColor: 'var(--vscode-button-background)',
                  border: '1px solid var(--vscode-button-border)',
                  outlineColor: 'var(--vscode-focusBorder)',
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
                  color: 'var(--vscode-button-secondaryForeground)',
                  backgroundColor: 'var(--vscode-button-secondaryBackground)',
                  border: '1px solid var(--vscode-button-secondaryBorder)',
                  outlineColor: 'var(--vscode-focusBorder)',
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
  const {
    sessions,
    sessionsPerPage,
    pinnedSessions,
    currentSessionsPage,
    setCurrentSessionsPage,
    loadingPinnedSessions,
    loadingUnpinnedSessions,
    noPinnedSessions,
    noUnpinnedSessions,
  } = useSessionsStore();

  const handleGetSessionChats = async (sessionId: number) => {
    const data = await getSessionChats(sessionId);
    useExtensionStore.setState({ viewType: 'chat' });
    useChatStore.setState({ history: data as ChatMessage[] });
  };

  const handlePinUnpinSession = async (
    session: Session,
    pin_or_unpin: 'PINNED' | 'UNPINNED',
    rank?: number
  ) => {
    if (pin_or_unpin === 'PINNED') {
      const pinnedSessionsCount = useSessionsStore.getState().pinnedSessions.length;
      if (pinnedSessionsCount >= 5) {
        alert('Maximum 5 pinned conversations allowed, please unpin one to pin another.');
        return;
      }
      const updatedPinnedSessions = [...pinnedSessions, session];
      pinUnpinSession(session.id, 'PINNED', pinnedSessionsCount);
      useSessionsStore.setState({ pinnedSessions: updatedPinnedSessions });
      useSessionsStore.setState({
        sessions: useSessionsStore.getState().sessions.filter((s) => s.id !== session.id),
      });
    } else {
      const updatedPinnedSessions = pinnedSessions.filter(
        (pinnedSession) => pinnedSession.id !== session.id
      );
      pinUnpinSession(session.id, 'UNPINNED');
      useSessionsStore.setState({ pinnedSessions: updatedPinnedSessions });
      useSessionsStore.setState({
        sessions: [...useSessionsStore.getState().sessions, session],
      });
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    useSessionsStore.setState({
      sessions: useSessionsStore.getState().sessions.filter((session) => session.id !== sessionId),
    });
    useSessionsStore.setState({
      pinnedSessions: useSessionsStore
        .getState()
        .pinnedSessions.filter((session) => session.id !== sessionId),
    });
    await deleteSession(sessionId);
  };

  const fetchSessions = async (pageNumber: number) => {
    const limit = sessionsPerPage;
    const offset = (pageNumber - 1) * sessionsPerPage;
    getSessions(limit, offset);
    setCurrentSessionsPage((prev) => prev + 1);
  };

  useEffect(() => {
    getPinnedSessions();
    if (sessions.length === 0) {
      fetchSessions(1);
    }
  }, []);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pinnedSessions.findIndex((session) => session.id === active.id);
    const newIndex = pinnedSessions.findIndex((session) => session.id === over.id);

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
      className="flex h-screen flex-col"
      style={{
        padding: '1rem',
        backgroundColor: 'var(--vscode-sidebar-background-rgb)',
      }}
    >
      {noPinnedSessions && noUnpinnedSessions ? (
        <div className="mt-[250px] flex flex-col items-center justify-center">
          <div className="mt-[10px] text-center text-gray-500">
            Your session history will appear here once you begin your AI development journey with
            DeputyDev
          </div>
        </div>
      ) : (
        <div>
          {loadingPinnedSessions && loadingUnpinnedSessions ? (
            <div className="mt-[350px] flex flex-col items-center justify-center">
              <div
                className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-current border-t-transparent"
                role="status"
                aria-label="loading"
              />
              <div className="mt-[10px] text-center text-gray-500">
                Loading your DeputyDev sessions history...
              </div>
            </div>
          ) : (
            <div>
              {/* pinned sessions  */}
              {pinnedSessions.length > 0 && (
                <div>
                  <h3
                    className="mb-2 text-lg font-semibold"
                    style={{ color: 'var(--vscode-editor-foreground)' }}
                  >
                    Pinned Conversations
                  </h3>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="relative">
                      <SortableContext
                        items={pinnedSessions}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="relative flex flex-col gap-2">
                          {pinnedSessions.map((session, index) => (
                            <SortableItem
                              key={session.id}
                              session={session}
                              handleGetSessionChats={handleGetSessionChats}
                              handleDeleteSession={handleDeleteSession}
                              isPinned={true}
                              handlePinUnpinSession={handlePinUnpinSession}
                              mountPopupOnBottom={index === 0}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </div>
                  </DndContext>
                </div>
              )}

              {/* unpinned sessions */}
              {sessions.length > 0 && (
                <div className="flex flex-1 flex-col">
                  <h3
                    className="mb-2 mt-6 text-lg font-semibold"
                    style={{ color: 'var(--vscode-editor-foreground)' }}
                  >
                    Past Conversations
                  </h3>
                  <div className="flex flex-1 flex-col">
                    {/* Move overflow to inner container */}
                    <div className="overflow-y-auto">
                      <div className="flex flex-col gap-2">
                        {sessions.map((session, index) => (
                          <SortableItem
                            key={session.id}
                            session={session}
                            handleGetSessionChats={handleGetSessionChats}
                            handleDeleteSession={handleDeleteSession}
                            isPinned={false}
                            disablePinning={pinnedSessions.length >= 5}
                            handlePinUnpinSession={handlePinUnpinSession}
                            mountPopupOnBottom={index === 0 && pinnedSessions.length === 0}
                          />
                        ))}
                        {useSessionsStore.getState().hasMore && (
                          <div
                            className="mt-2 flex animate-bounce cursor-pointer justify-center"
                            onClick={() => fetchSessions(currentSessionsPage)}
                          >
                            <ArrowDown />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
