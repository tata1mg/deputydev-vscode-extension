import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CircleStop, Loader2, AlertCircle, XCircle, FileDiff } from 'lucide-react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { getFilteredChatList, useChatStore } from '@/stores/chatStore'; // adjust path
import { ChatStatus, ChatStatusType } from '@/types';
import useExtensionStore from '@/stores/useExtensionStore';
// -----------------------------
// Types
// -----------------------------
export type Chats = {
  chatId: string;
  summary: string;
  updatedAt: string; // ISO string
  state: ChatStatus;
};

// -----------------------------
// Utilities
// -----------------------------
const getLocaleTimeString = (dateString: string) => {
  const cleanedDateString = dateString.split('.')[0] + 'Z'; // Force UTC
  const date = parseISO(cleanedDateString);
  return formatDistanceToNowStrict(date, { addSuffix: true });
};

// -----------------------------
// State Visuals
// -----------------------------
const STATE_COLORS: Record<ChatStatusType, string> = {
  in_progress: 'bg-yellow-400 text-yellow-500',
  completed: 'bg-green-500 text-green-500',
  error: 'bg-red-500 text-red-500',
  aborted: 'bg-gray-400 text-gray-400',
  action_required: 'bg-blue-500 text-blue-500',
  history: 'bg-gray-400 text-gray-400',
};

const STATE_TOOLTIPS: Record<ChatStatusType, string> = {
  in_progress: 'Stop chat',
  error: 'Chat Error',
  completed: 'Chat completed',
  aborted: 'Chat Stopped',
  action_required: 'Action required',
  history: 'Chat history',
};

// -----------------------------
// Session Item
// -----------------------------
const ChatItem: React.FC<{
  chat: Chats;
  handleGetChatMessages: (chatId: string) => void;
  unacceptedFileCount: number;
}> = ({ chat, handleGetChatMessages, unacceptedFileCount }) => {
  const [hovered, setHovered] = React.useState(false);
  const showStopHover = chat.state.type === 'in_progress' || chat.state.type === 'action_required';

  const Icon = React.useMemo(() => {
    switch (chat.state.type) {
      case 'in_progress':
        return Loader2;
      case 'error':
      case 'action_required':
        return AlertCircle;
      case 'aborted':
        return XCircle;
      case 'completed':
        return null;
      default:
        return Loader2;
    }
  }, [chat.state]);

  const onStatusClick = () => {
    if (chat.state.type === 'in_progress' || chat.state.type === 'action_required') {
      useChatStore.getState().cancelChat(chat.chatId);
    }
  };

  return (
    <div
      className="group relative flex items-center gap-3 overflow-visible rounded-lg border p-3 shadow-sm"
      style={{
        border: '1px solid var(--vscode-editor-border)',
        backgroundColor: 'var(--vscode-editor-background)',
      }}
    >
      {/* Main content */}
      <div
        onClick={() => handleGetChatMessages(chat.chatId)}
        className="flex w-full cursor-pointer items-start justify-between gap-2 overflow-hidden"
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            {getLocaleTimeString(chat.updatedAt)}
          </div>

          <Tooltip.Root delayDuration={150}>
            <Tooltip.Trigger asChild>
              <div
                className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium"
                style={{ color: 'var(--vscode-editor-foreground)' }}
              >
                {chat.summary}
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                sideOffset={12}
                style={{
                  backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                  color: 'var(--vscode-editorHoverWidget-foreground)',
                  border: '1px solid var(--vscode-editorHoverWidget-border)',
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  maxWidth: 'min(70vw, 600px)',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  zIndex: 2147483647,
                }}
              >
                {chat.summary}
                <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>

      {/* ✅ Right-side icons (diff + status) */}
      <div className="flex items-center gap-1">
        {/* 🔸 Edited files icon (if unaccepted changes exist) */}
        {unacceptedFileCount > 0 && (
          <Tooltip.Root delayDuration={100}>
            <Tooltip.Trigger asChild>
              <div className="relative flex items-center">
                <FileDiff
                  size={14}
                  className="text-orange-400"
                  aria-label={`${unacceptedFileCount} edited file(s) pending review`}
                />
                {/* optional small badge showing count visually */}
                {unacceptedFileCount > 1 && (
                  <span className="absolute -right-2 -top-1 rounded-full bg-orange-500 px-[3px] text-[9px] font-semibold text-white">
                    {unacceptedFileCount}
                  </span>
                )}
              </div>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                sideOffset={4}
                style={{
                  backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                  color: 'var(--vscode-editorHoverWidget-foreground)',
                  border: '1px solid var(--vscode-editorHoverWidget-border)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  zIndex: 2147483647,
                }}
              >
                {`${unacceptedFileCount} edited ${unacceptedFileCount === 1 ? 'file' : 'files'} pending review`}
                <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}

        {/* 🟢 Chat status icon */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div
              className="relative flex h-5 w-5 items-center justify-center"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              {(chat.state.type === 'in_progress' || chat.state.type === 'action_required') &&
                !hovered && (
                  <span
                    className={`absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full opacity-50 ${
                      STATE_COLORS[chat.state.type].split(' ')[0]
                    }`}
                  />
                )}

              {showStopHover && hovered ? (
                <button
                  aria-label="Stop chat"
                  className="relative flex items-center justify-center rounded-full p-0.5 hover:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusClick();
                  }}
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
                >
                  <CircleStop size={14} className="text-red-500" />
                </button>
              ) : Icon ? (
                <span className="relative flex items-center justify-center rounded-full">
                  <Icon
                    size={14}
                    className={`${
                      chat.state.type === 'error'
                        ? 'text-red-500'
                        : chat.state.type === 'action_required'
                          ? 'text-blue-500'
                          : STATE_COLORS[chat.state.type].split(' ')[1]
                    } ${chat.state.type === 'in_progress' ? 'animate-spin' : ''}`}
                  />
                </span>
              ) : (
                <span
                  className={`relative inline-flex rounded-full ${
                    chat.state.type === 'completed'
                      ? 'h-2.5 w-2.5 bg-green-500'
                      : 'h-2.5 w-2.5 bg-gray-400'
                  }`}
                />
              )}
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              sideOffset={6}
              style={{
                backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                color: 'var(--vscode-editorHoverWidget-foreground)',
                border: '1px solid var(--vscode-editorHoverWidget-border)',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 11,
                zIndex: 2147483647,
              }}
            >
              {STATE_TOOLTIPS[chat.state.type]}
              <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </div>
  );
};
const ChatList: React.FC = () => {
  const { switchChat } = useChatStore();
  const chatList = getFilteredChatList();
  const handleGetChatMessages = (chatId: string) => {
    switchChat(chatId); // make it active
  };

  const handleViewMore = () => {
    useExtensionStore.setState({ viewType: 'history' });
  };
  const hasMoreThanThree = chatList.length >= 3;

  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={200}>
      <div className="min-h-[40vh] space-y-2 p-4">
        {chatList.map((s) => (
          <ChatItem
            key={s.chatId}
            chat={s}
            handleGetChatMessages={handleGetChatMessages}
            unacceptedFileCount={s.changedFiles}
          />
        ))}

        {hasMoreThanThree && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleViewMore}
              className="rounded-md border border-[--vscode-editorHoverWidget-border] bg-[--vscode-editorHoverWidget-background] px-3 py-1.5 text-xs font-medium text-[--vscode-editorHoverWidget-foreground] transition hover:bg-[--vscode-button-hoverBackground]"
            >
              View more chats
            </button>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
};

export default ChatList;
