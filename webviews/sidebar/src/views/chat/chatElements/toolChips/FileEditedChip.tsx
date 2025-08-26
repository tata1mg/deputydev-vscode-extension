import { getLanguageInfoByExtension } from '@/utils/getLanguageByExtension';
import { usePartialFileDiff } from '@/utils/usePartialFileDiff';
import { ChevronDown, ChevronUp, Copy, CheckCircle } from 'lucide-react';
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
  let response: any;
  let path: string | undefined;
  let diff: string | undefined;

  if (toolResponse?.result) {
    response = toolResponse.result;
  } else if (toolResponse) {
    response = toolResponse;
  }

  if (toolRequest?.requestData && typeof toolRequest.requestData === 'object') {
    ({ path, diff } = toolRequest.requestData);
  } else {
    // parse out path/diff/complete from the partial JSON
    ({ path, diff } = usePartialFileDiff(toolRequest?.requestData as string));
  }
  const isWriteToFileTool = toolRequest?.toolName === 'write_to_file';
  // just the filename for display
  const filename = path?.split('/').pop() ?? '';
  const ext = filename.split('.').pop() ?? '';
  const { p: language } = getLanguageInfoByExtension(ext);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusText = isWriteToFileTool
    ? {
        pending: 'Writing',
        completed: 'Saved',
        idle: 'Saved',
        aborted: 'Write aborted',
        error: 'Error writing',
      }[toolRunStatus] || 'Saved'
    : {
        pending: 'Editing',
        completed: 'Edited',
        idle: 'Edited',
        aborted: 'Edit aborted',
        error: 'Error editing',
      }[toolRunStatus] || 'Edited';

  const copyToClipboard = () => {
    if (diff) {
      navigator.clipboard.writeText(diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mt-2 w-full min-w-0 rounded border border-gray-500/40 px-2 py-2 text-sm">
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="flex w-full min-w-0 items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <div className="flex-shrink-0">
              <ToolStatusIcon status={toolRunStatus} />
            </div>
            <span
              className={`whitespace-nowrap ${toolRunStatus === 'error' ? 'text-red-400' : ''}`}
            >
              {statusText}
            </span>
            {path && (
              <div className="min-w-0 flex-shrink">
                <button
                  className="w-full truncate rounded border border-gray-500/40 bg-neutral-600/5 px-1.5 py-0.5 text-left text-xs transition hover:bg-neutral-600/20"
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

          <div className="ml-2 flex flex-shrink-0 items-center gap-2">
            {toolRunStatus !== 'error' && response && (
              <div className="flex items-center gap-2 whitespace-nowrap text-xs">
                {response.addedLines != null && response.addedLines > 0 && (
                  <span className="text-green-400">+{response.addedLines}</span>
                )}
                {response.removedLines != null && response.removedLines > 0 && (
                  <span className="text-red-400">-{response.removedLines}</span>
                )}
              </div>
            )}
            {toolRunStatus === 'completed' && (
              <button
                className="flex-shrink-0 text-gray-300 transition hover:text-white"
                onClick={() => setShowSnippet((prev) => !prev)}
                title={showSnippet ? 'Hide code' : 'Show code'}
              >
                {showSnippet ? (
                  <ChevronUp className="flex-shrink-0" />
                ) : (
                  <ChevronDown className="flex-shrink-0" />
                )}
              </button>
            )}
          </div>
        </div>

        {toolRunStatus === 'completed' && showSnippet && diff && (
          <div className="relative mt-2 border-t border-gray-700 pt-2">
            <button
              onClick={copyToClipboard}
              className="absolute right-2 top-3 rounded p-1 hover:bg-gray-200"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              )}
            </button>
            <SnippetReference snippet={{ content: diff, language }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FileEditedChip;
