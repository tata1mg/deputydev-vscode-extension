import { ToolProps } from '@/types';
import React, { useEffect, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useThemeStore } from '@/stores/useThemeStore';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula, duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Tooltip } from 'react-tooltip';
import { openFile } from '@/commandApi';
import { joinPath } from '@/utils/joinPath';
import { ToolStatusIcon } from './ChipBase';

const IterativeFileReaderChip: React.FC<ToolProps> = ({
  toolRunStatus,
  toolRequest,
  toolResponse,
  toolUseId,
}) => {
  const { themeKind } = useThemeStore();
  const [filePath, setFilePath] = useState<string | undefined>();
  const [startLine, setStartLine] = useState<number | undefined>();
  const [endLine, setEndLine] = useState<number | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [repoPath, setRepoPath] = useState<string | undefined>();
  const [showDropDown, setShowDropDown] = useState(false);
  const [copiedRequest, setCopiedRequest] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [toolRequestForDisplay, setToolRequestForDisplay] = useState<any>();
  const toolInputJson = toolRequest?.requestData;

  const handleDropDown = () => {
    setShowDropDown(!showDropDown);
  };

  const highlighterStyle =
    themeKind === 'light' || themeKind === 'high-contrast-light' ? duotoneLight : dracula;

  useEffect(() => {
    try {
      let parsedContent: any;

      if (typeof toolInputJson === 'string') {
        parsedContent = JSON.parse(toolInputJson);
      } else {
        parsedContent = toolInputJson;
      }

      if (parsedContent && typeof parsedContent === 'object') {
        const {
          file_path = undefined,
          start_line = undefined,
          end_line = undefined,
          repo_path = undefined,
        } = parsedContent ?? {};

        setFilePath(file_path);
        setStartLine(start_line);
        setEndLine(end_line);
        setRepoPath(repo_path);

        if (file_path) {
          const filename = file_path.split('/').pop();
          setFileName(filename);
        }
      }

      setToolRequestForDisplay(parsedContent);
    } catch (e) {
      // For invalid json
    }
  }, [toolInputJson]);

  const lineRange = startLine != null && endLine != null ? `#${startLine}-${endLine}` : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm">
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex w-full min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <div className="flex-shrink-0">
                  <ToolStatusIcon status={toolRunStatus} />
                </div>
                <span
                  className={`whitespace-nowrap ${toolRunStatus === 'error' ? 'text-red-400' : ''}`}
                >
                  File analyzed
                </span>
                {filePath && fileName && (
                  <div className="min-w-0 flex-shrink">
                    <button
                      className="w-full truncate rounded border border-gray-500/40 bg-neutral-600/5 px-1.5 py-0.5 text-left text-xs transition hover:bg-neutral-600/20"
                      onClick={() => {
                        const hasRepoPath = !!repoPath;
                        const fullPath = hasRepoPath ? joinPath(repoPath, filePath) : filePath;
                        openFile(fullPath, startLine, endLine, hasRepoPath ? true : undefined);
                      }}
                      title={filePath}
                      data-tooltip-id="tool-chip-tool-tip"
                      data-tooltip-content={fileName}
                    >
                      {fileName}
                      {lineRange && <span className="text-gray-400">{lineRange}</span>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dropdown icon to show/hide request/response */}
            <div className="cursor-pointer" onClick={() => handleDropDown()}>
              {!showDropDown ? <ChevronDown /> : <ChevronUp />}
            </div>
          </div>
        </div>

        {/* Show request and response details */}
        {showDropDown && toolRequest && (
          <div className="space-y-4">
            {/* Request JSON with copy */}
            <div className="relative overflow-x-hidden rounded bg-gray-500/10 p-2">
              <button
                onClick={() => {
                  copyToClipboard(JSON.stringify(toolRequest.requestData, null, 2));
                  setCopiedRequest(true);
                  setTimeout(() => setCopiedRequest(false), 2000);
                }}
                className="absolute right-2 top-2 rounded p-1 hover:bg-gray-200"
                title="Copy to clipboard"
              >
                {copiedRequest ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                )}
              </button>
              <div className="mb-2 font-semibold">Ran with these arguments:</div>
              <div className="word-break: max-h-[200px] w-full overflow-y-auto">
                <SyntaxHighlighter
                  language="json"
                  style={highlighterStyle}
                  customStyle={{
                    fontSize: 'var(--vscode-font-size)',
                    fontWeight: 'var(--vscode-font-weight)',
                    fontFamily: 'var(--vscode-editor-font-family)',
                    backgroundColor: 'var(--vscode-editor-background)',
                    margin: 0,
                    padding: '1rem',
                    maxHeight: '200px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    wordWrap: 'break-word',
                    maxWidth: '100%',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    overflowWrap: 'break-word',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  wrapLines={true}
                  wrapLongLines={true}
                  lineProps={{ style: { wordBreak: 'break-word', whiteSpace: 'pre-wrap' } }}
                >
                  {JSON.stringify(toolRequestForDisplay, null, 2)}
                </SyntaxHighlighter>
              </div>
            </div>

            {/* Response JSON with copy */}
            {toolResponse && (
              <div className="relative overflow-x-hidden rounded bg-gray-500/10 p-2">
                <button
                  onClick={() => {
                    copyToClipboard(JSON.stringify(toolResponse, null, 2));
                    setCopiedResponse(true);
                    setTimeout(() => setCopiedResponse(false), 2000);
                  }}
                  className="absolute right-2 top-2 rounded p-1 hover:bg-gray-200"
                  title="Copy to clipboard"
                >
                  {copiedResponse ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
                <div className="mb-2 font-semibold">Output</div>
                <div className="word-break: max-h-[200px] w-full overflow-y-auto">
                  <SyntaxHighlighter
                    language="json"
                    style={highlighterStyle}
                    customStyle={{
                      fontSize: 'var(--vscode-font-size)',
                      fontWeight: 'var(--vscode-font-weight)',
                      fontFamily: 'var(--vscode-editor-font-family)',
                      backgroundColor: 'var(--vscode-editor-background)',
                      margin: 0,
                      padding: '1rem',
                      maxHeight: '200px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      wordWrap: 'break-word',
                      maxWidth: '100%',
                      overflowX: 'hidden',
                      overflowY: 'auto',
                      overflowWrap: 'break-word',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                    wrapLines={true}
                    wrapLongLines={true}
                    lineProps={{ style: { wordBreak: 'break-word', whiteSpace: 'pre-wrap' } }}
                  >
                    {JSON.stringify(toolResponse, null, 2)}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}
          </div>
        )}
        <Tooltip id="tool-chip-tool-tip" />
      </div>
    </div>
  );
};

export default IterativeFileReaderChip;
