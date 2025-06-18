import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle, RotateCw } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
// import "react-tooltip/dist/react-tooltip.css"; // Import CSS for styling
import { openFile } from '@/commandApi';
import { useChatStore } from '@/stores/chatStore';
import { SnippetReference } from './CodeBlockStyle';

/**
 *
 * Represents the status of chips
 */
export type Status = 'idle' | 'pending' | 'completed' | 'error' | 'aborted';

/**
 * Props common to both analyzed code and searched codebase.
 */
// interface CommonProps {
//   fileName?: string;
//   status: Status;
//   onClick?: () => void;
//   autoFetchChunks?: boolean;
// }

/**
 * Props for the ThinkingChip component.
 */
interface ThinkingChipProps {
  completed?: boolean;
}

/**
 * Status Icon Component - Prevents duplication of status icon logic.
 */
export const StatusIcon: React.FC<{ status: Status }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-400" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-400" />;
    case 'aborted':
      return <XCircle className="h-4 w-4" />;
    default:
      return null;
  }
};

/**
 * Component for Searched Codebase.
 * Displays status and file count based on props from history.
 */

export function ToolUseStatusMessage({
  status,
  tool_name,
  fileCount,
}: {
  status: Status;
  fileCount?: number;
  tool_name?: string;
}) {
  let displayText;
  switch (tool_name) {
    case 'public_url_content_reader':
      displayText =
        status === 'pending'
          ? 'Analysing URL...'
          : status === 'error'
            ? 'Error Analysing URL'
            : 'Analyzed URL';
      break;
    case 'web_search':
      displayText =
        status === 'pending'
          ? 'Searching Web...'
          : status === 'error'
            ? 'Error Searching Web'
            : 'Searched Web';
      break;
    case 'file_path_searcher':
      displayText =
        status === 'pending'
          ? 'Scanning file paths...'
          : status === 'error'
            ? 'Error scanning file paths'
            : 'Scanned file paths';
      break;
    case 'grep_search':
      displayText =
        status === 'pending'
          ? 'Running grep...'
          : status === 'error'
            ? 'Error running grep search'
            : 'Grep search completed';
      break;
    default:
      if (status === 'pending') {
        displayText = 'Searching codebase...';
      } else if (status === 'error') {
        displayText = 'Error searching codebase';
      } else if (status === 'aborted') {
        displayText = 'Search aborted';
      } else {
        displayText = 'Searched codebase';
      }
      break;
  }

  return (
    <div
      className="mt-2 flex w-full items-center justify-between rounded border-[1px] border-gray-500/40 px-2 py-2 text-sm"
      title="Searched Codebase"
    >
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className="">{displayText}</span>
      </div>
      <div className="text-gray-300">{fileCount !== undefined ? `${fileCount} results` : ''}</div>
    </div>
  );
}

/**
 * Function component for ThinkingChip - Displays a chip representing a thinking state.
 */

export function ThinkingChip({ completed }: ThinkingChipProps) {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    if (completed) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + '.' : '.'));
    }, 500);
    return () => clearInterval(interval);
  }, [completed]);

  return (
    <div
      className="mt-2 flex w-full items-center gap-2 rounded border-[1px] border-gray-500/40 px-2 py-2 text-sm"
      title={completed ? 'Thinking Complete' : 'Thinking...'}
    >
      {!completed ? (
        <>
          <StatusIcon status="pending" />
          <span>Thinking{dots}</span>
        </>
      ) : (
        <>
          <StatusIcon status="completed" />
          <span>Thinking complete</span>
        </>
      )}
    </div>
  );
}

export function RetryChip({
  error_msg,
  retry,
  payload_to_retry,
}: {
  error_msg: string;
  retry: boolean;
  payload_to_retry: unknown;
}) {
  const {
    history: messages,
    sendChatMessage,
    current,
    showSkeleton,
    showSessionsBox,
  } = useChatStore();

  // Retry function defined within ChatArea component
  const retryChat = () => {
    if (!messages.length) {
      // console.log("No messages in history");
      return;
    }
    // Get the last message from the chat history
    const lastMsg = messages[messages.length - 1];
    // console.log("Last message:", JSON.stringify(lastMsg));

    if (lastMsg.type === 'ERROR') {
      // The error message should have the payload to retry stored in 'payload_to_retry'
      const errorData = lastMsg; // Assuming type ChatErrorMessage
      // console.log(
      //   "Payload data just before sending:",
      //   JSON.stringify(errorData.payload_to_retry, null, 2)
      // );
      const payload: any = errorData.payload_to_retry;

      // Call sendChatMessage with the retry flag set to true,
      // passing the stored payload so that UI state updates are skipped.
      sendChatMessage('retry', [], () => {}, undefined, true, payload);
    } else {
      // console.log("No error found to retry.");
    }
  };

  return (
    <div
      className="mt-2 flex w-full items-center justify-between rounded border-[1px] border-red-500/40 px-2 py-2 text-sm"
      title="Error occurred"
    >
      <div className="flex items-center gap-2">
        <StatusIcon status="error" />
        <span className="text-red-400">An error occurred</span>
      </div>
      {retry && (
        <button
          className="rounded p-1 font-bold text-gray-300 hover:bg-gray-500"
          onClick={retryChat}
        >
          <RotateCw className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/**
 * Component for file edited
 * Displays file name and and lines changed
 */
import { ChevronRight, ChevronDown } from 'lucide-react';
import { usePartialFileDiff } from '@/utils/usePartialFileDiff';
import { getLanguageInfoByExtension } from '@/utils/getLanguageByExtension';
import { useIndexingStore } from '@/stores/indexingDataStore';

export function FileEditedChip({
  isToolUse,
  isWriteToFileTool,
  content,
  status,
  addedLines = 0,
  removedLines = 0,
  isStreaming,
  filepath = '',
}: {
  isToolUse: boolean;
  content: string;
  status: Status;
  isStreaming: boolean | true;
  isWriteToFileTool: boolean;
  addedLines?: number | null;
  removedLines?: number | null;
  filepath?: string;
}) {
  let path: string | undefined;
  let diff: string | undefined;
  let complete: boolean | undefined;

  // parse out path/diff/complete from the partial JSON
  if (isToolUse) {
    ({ path, diff, complete } = usePartialFileDiff(content));
  } else {
    path = filepath;
    diff = content;
    complete = true;
  }
  // just the filename for display
  const filename = path?.split('/').pop() ?? '';
  const ext = filename.split('.').pop() ?? '';
  const { p: language } = getLanguageInfoByExtension(ext);
  const [showSnippet, setShowSnippet] = useState(false);
  let statusText;
  let statusColor = '';

  // Define alternate status text if isWriteToFileTool is true
  const writeToFileStatusText: Record<string, string> = {
    pending: 'Writing',
    completed: 'Saved',
    idle: 'Saved',
    aborted: 'Write aborted',
    error: 'Error writing',
  };

  const defaultStatusText: Record<string, string> = {
    pending: 'Editing',
    completed: 'Edited',
    idle: 'Edited',
    aborted: 'Edit aborted',
    error: 'Error editing',
  };

  const statusKey = status in writeToFileStatusText ? status : 'error';

  if (isWriteToFileTool) {
    statusText = writeToFileStatusText[statusKey];
  } else {
    statusText = defaultStatusText[statusKey];
  }

  if (status === 'error') {
    statusColor = 'text-red-400';
  }

  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm">
      {/* Top row: filename area on the left, lines added/removed on the right */}
      <div className="flex w-full items-center justify-between gap-2" title="File Edited">
        {/* Left side: expand only as needed */}
        <div className="flex items-center gap-2">
          {!isStreaming && (
            <button
              className="text-xs text-gray-300 transition hover:text-white"
              onClick={() => setShowSnippet((prev) => !prev)}
              title={showSnippet ? 'Hide code' : 'Show code'}
            >
              {showSnippet ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          <StatusIcon status={status} />
          <span className={statusColor}>{statusText}</span>
          {path && (
            <div>
              <button
                className="max-w-xs truncate rounded border border-gray-500/40 bg-neutral-600/5 px-1 py-0.5 text-left text-xs transition hover:bg-neutral-600"
                onClick={() => openFile(path)}
                data-tooltip-id="filepath-tooltip"
                data-tooltip-content={path}
              >
                {filename}
              </button>
              <Tooltip id="filepath-tooltip" />
            </div>
          )}
        </div>

        {/* Right side: lines added/removed */}
        {status !== 'error' && (
          <div className="flex items-center gap-2 text-xs">
            {addedLines != null && addedLines > 0 && (
              <span className="text-green-400">+{addedLines}</span>
            )}
            {removedLines != null && removedLines > 0 && (
              <span className="text-red-400">-{removedLines}</span>
            )}
          </div>
        )}
      </div>

      {/* Collapsible code snippet */}
      {!isStreaming && showSnippet && diff && (
        <div className="mt-2 border-t border-gray-700 pt-2">
          <SnippetReference snippet={{ content: diff, language }} />
        </div>
      )}
    </div>
  );
}
