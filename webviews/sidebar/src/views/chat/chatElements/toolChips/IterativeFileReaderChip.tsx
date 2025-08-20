import React, { useEffect, useState } from 'react';
import { openFile } from '@/commandApi';
import { joinPath } from '@/utils/joinPath';
import { ToolProps } from '@/types';
import { StatusIcon } from './ThinkingChip';

const IterativeFileReader: React.FC<ToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  const [filePath, setFilePath] = useState<string | undefined>();
  const [startLine, setStartLine] = useState<number | undefined>();
  const [endLine, setEndLine] = useState<number | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [repoPath, setRepoPath] = useState<string | undefined>();
  const toolInputJson = toolRequest?.requestData;

  useEffect(() => {
    try {
      const parsedContent = JSON.parse(toolInputJson);
      const { file_path, start_line, end_line, repo_path } = parsedContent;
      setFilePath(file_path);
      setStartLine(start_line);
      setEndLine(end_line);
      setRepoPath(repo_path);

      if (file_path) {
        const filename = file_path ? file_path.split('/').pop() : '';
        setFileName(filename);
      }
    } catch (e) {
      // Intentionally empty: toolInputJson might be invalid JSON
    }
  }, [toolInputJson]);

  const lineRange = startLine != null && endLine != null ? `#${startLine}-${endLine}` : '';

  return (
    <div
      className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm"
      title="Analyzing Files"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <div className="flex h-4 min-h-4 w-4 min-w-4 items-center justify-center">
            <StatusIcon status={toolRunStatus} />
          </div>
          <span className="whitespace-nowrap">File analyzed</span>
          {filePath && fileName && (
            <button
              className="max-w-xs truncate rounded border border-gray-500/40 bg-neutral-600/5 px-1 py-0.5 text-left text-xs transition hover:bg-neutral-600"
              onClick={() => {
                const hasRepoPath = !!repoPath;
                const fullPath = hasRepoPath ? joinPath(repoPath, filePath) : filePath;
                openFile(fullPath, startLine, endLine, hasRepoPath ? true : undefined);
              }}
              title={filePath}
            >
              {fileName}
              {lineRange && <span className="text-gray-400">{lineRange}</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IterativeFileReader;
