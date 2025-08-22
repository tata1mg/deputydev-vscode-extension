import { getLanguageInfoByExtension } from '@/utils/getLanguageByExtension';
import { usePartialFileDiff } from '@/utils/usePartialFileDiff';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ToolProps, ToolRunStatus } from '@/types';
import { useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { openFile } from '@/commandApi';
import { SnippetReference } from '../CodeBlockStyle';
import { ToolStatusIcon } from './ChipBase';

const FileEditedChip: React.FC<ToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  // parse out path/diff/complete from the partial JSON
  const { path, diff, complete } = usePartialFileDiff(toolRequest?.requestData as string);
  const isWriteToFileTool = toolRequest?.toolName === 'write_to_file';
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

  const statusKey = toolRunStatus in writeToFileStatusText ? toolRunStatus : 'error';

  if (isWriteToFileTool) {
    statusText = writeToFileStatusText[statusKey];
  } else {
    statusText = defaultStatusText[statusKey];
  }

  if (toolRunStatus === 'error') {
    statusColor = 'text-red-400';
  }

  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm">
      {/* Top row: filename area on the left, lines added/removed on the right */}
      <div className="flex w-full items-center justify-between gap-2" title="File Edited">
        {/* Left side: expand only as needed */}
        <div className="flex items-center gap-2">
          {toolRunStatus === 'completed' && (
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
          <ToolStatusIcon status={toolRunStatus} />
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
        {toolRunStatus !== 'error' && toolResponse && (
          <div className="flex items-center gap-2 text-xs">
            {toolResponse.addedLines != null && toolResponse.addedLines > 0 && (
              <span className="text-green-400">+{toolResponse.addedLines}</span>
            )}
            {toolResponse.removedLines != null && toolResponse.removedLines > 0 && (
              <span className="text-red-400">-{toolResponse.removedLines}</span>
            )}
          </div>
        )}
      </div>

      {/* Collapsible code snippet */}
      {toolRunStatus === 'completed' && showSnippet && diff && (
        <div className="mt-2 border-t border-gray-700 pt-2">
          <SnippetReference snippet={{ content: diff, language }} />
        </div>
      )}
    </div>
  );
};

export default FileEditedChip;
