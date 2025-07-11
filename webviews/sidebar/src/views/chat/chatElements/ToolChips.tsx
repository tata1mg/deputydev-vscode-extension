import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, Loader2, XCircle, RotateCw } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
// import "react-tooltip/dist/react-tooltip.css"; // Import CSS for styling
import { openFile } from '@/commandApi';
import { useChatStore, useChatSettingStore } from '@/stores/chatStore';
import { SnippetReference } from './CodeBlockStyle';
import ModelSelector from './modelSelector';

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
  const { history: messages, sendChatMessage } = useChatStore();

  // Get the last message to check if it's a throttling error
  const lastMsg = messages[messages.length - 1];
  const isThrottlingError = lastMsg?.type === 'ERROR' && (lastMsg as any).isThrottling;

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
      const errorData = lastMsg;
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

/**
 * Component for suggesting model changes when throttling occurs
 */
export function ModelSuggestionChip() {
  const { llmModels } = useChatStore();
  const { activeModel } = useChatSettingStore();

  // Suggest all other models except the current one
  const alternativeModels = llmModels.filter((model) => model.name !== activeModel);

  // Placeholder: UI to be implemented later
  return null;
}

/**
 *  ChatMessage: UI for throttling errors with retry-after, message, retry, and model switch
 */
export function ThrottledChatMessage({
  retryAfterSeconds = 0,
  onRetry,
  onModelChangeAndRetry,
  currentModel,
}: {
  retryAfterSeconds?: number;
  onRetry: () => void;
  onModelChangeAndRetry: (modelName: string) => void;
  currentModel: string;
}) {
  const { llmModels } = useChatStore();
  const { activeModel } = useChatSettingStore();
  const [secondsLeft, setSecondsLeft] = useState(retryAfterSeconds);
  const [selectedModel, setSelectedModel] = useState(currentModel);

  useEffect(() => {
    setSelectedModel(currentModel);
  }, [currentModel]);

  useEffect(() => {
    setSecondsLeft(retryAfterSeconds);
    if (retryAfterSeconds > 0) {
      const interval = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (secondsLeft === 0) {
      onRetry();
    }
  }, [secondsLeft]);

  // Only show models that are not throttled (if 'throttled' property exists), otherwise fallback to all except current
  const availableModels = llmModels.some((m) => 'throttled' in m)
    ? llmModels.filter((m) => !(m as any).throttled)
    : llmModels;

  function formatTime(secs: number) {
    if (!secs || secs <= 0) return 'Throttled';
    if (secs < 60) return `${secs}s left`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s left`;
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
    useChatSettingStore.setState({ activeModel: e.target.value });
    onModelChangeAndRetry(e.target.value); // Immediately retry and close popup
  };

  // Retry button only retries the current model
  const handleTryAgain = () => {
    onRetry();
  };

  return (
    <div className="mt-2 flex w-full items-center justify-center">
      <div className="w-full max-w-md rounded border-[1px] border-yellow-500/40 bg-[var(--vscode-editorWidget-background)] px-2 py-2 text-sm shadow-md">
        {/* Top strip: Throttling time */}
        <div className="w-full rounded-t border-b border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-center text-xs font-semibold text-yellow-500">
          {secondsLeft > 0 ? `Throttling: ${formatTime(secondsLeft)}` : 'Throttled'}
        </div>
        {/* Main error message */}
        <div className="mb-4 mt-3 flex items-center justify-center gap-2">
          <StatusIcon status="error" />
          <span className="text-white-400 font-medium">
            This chat is currently being throttled. Please retry or switch to a different model.
          </span>
        </div>
        {/* Model selector and Try Again button */}
        <div className="mt-2 flex flex-row items-center justify-center gap-2">
          <select
            className="h-5 min-w-[120px] rounded border border-gray-400 bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-input-foreground)] focus:outline-none"
            value={selectedModel}
            onChange={handleModelChange}
            style={{ height: '26px' }}
          >
            {(llmModels.some((m) => 'throttled' in m)
              ? llmModels.filter(
                  (model) => model.name !== currentModel && !(model as any).throttled
                )
              : llmModels.filter((model) => model.name !== currentModel)
            ).map((model) => (
              <option key={model.name} value={model.name}>
                {model.display_name}
              </option>
            ))}
          </select>
          <button
            className="border-white-400/60 text-white-400 hover:bg-white-400/10 flex h-5 items-center justify-center rounded border bg-transparent p-1.5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleTryAgain}
            title="Retry"
            style={{ height: '26px', width: '26px' }}
          >
            <RotateCw className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
