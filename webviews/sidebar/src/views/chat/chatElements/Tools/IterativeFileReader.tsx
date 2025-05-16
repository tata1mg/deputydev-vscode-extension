import React, { useEffect, useState } from 'react';
import { Status, StatusIcon } from '../ToolChips';
import { parse as parsePath } from 'path';
import { openFile } from '@/commandApi';

/**
 * Completely handles only the iterative_file_reader status display
 */
export function IterativeFileReader({
  status,
  tool_name,
  toolInputJson,
  fileCount,
}: {
  status: Status;
  tool_name: string;
  toolInputJson: string;
  fileCount?: number;
}) {
  const [filePath, setFilePath] = useState<string | undefined>();
  const [startLine, setStartLine] = useState<number | undefined>();
  const [endLine, setEndLine] = useState<number | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();

  useEffect(() => {
    try {
      const parsedContent = JSON.parse(toolInputJson);
      const { file_path, start_line, end_line } = parsedContent;
      setFilePath(file_path);
      setStartLine(start_line);
      setEndLine(end_line);

      if (file_path) {
        const filename = file_path ? file_path.split('/').pop() : '';
        setFileName(filename);
      }
    } catch (e) {
      // Intentionally empty: toolInputJson might be invalid JSON
    }
  }, [toolInputJson]);

  let displayText: string;
  switch (status) {
    case 'pending':
      displayText = 'Reading files';
      break;
    case 'error':
      displayText = 'Error analyzing files';
      break;
    default:
      displayText = 'File analyzed';
      break;
  }

  const lineRange = startLine != null && endLine != null ? `#${startLine}-${endLine}` : '';

  return (
    <div
      className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm"
      title="Analyzing Files"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusIcon status={status} />
          <span>{displayText}</span>
          {filePath && fileName && (
            <button
              className="overflow-hidden truncate text-ellipsis rounded border border-gray-500/40 bg-neutral-600/5 px-1 py-0.5 text-left text-xs transition hover:bg-neutral-600"
              onClick={() => openFile(filePath)}
              title={filePath}
            >
              {fileName}
              {lineRange && <span className="text-gray-400">{lineRange}</span>}
            </button>
          )}
        </div>

        <div className="text-gray-300">{fileCount !== undefined ? `${fileCount} results` : ''}</div>
      </div>
    </div>
  );
}
