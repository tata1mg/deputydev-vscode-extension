import { ToolProps, ToolRunStatus } from '@/types';
import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useThemeStore } from '@/stores/useThemeStore';
import { toolUseApprovalUpdate } from '@/commandApi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula, duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Tooltip } from 'react-tooltip';

export const ToolStatusIcon: React.FC<{ status: ToolRunStatus }> = ({ status }) => {
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

const ChipBase: React.FC<ToolProps> = ({
  toolRunStatus,
  toolRequest,
  toolResponse,
  toolUseId,
  displayText,
}) => {
  const { themeKind } = useThemeStore();
  const borderClass =
    themeKind === 'high-contrast' || themeKind === 'high-contrast-light'
      ? 'border border-[--deputydev-button-border]'
      : '';
  const [showDropDown, setShowDropDown] = useState(false);
  const [autoApproval, setAutoApproval] = useState(false);
  const [showConsent, setShowConsent] = useState(true);
  const [requestRejected, setRequestRejected] = useState(false);

  // hover background and temporary copy state
  const [copiedRequest, setCopiedRequest] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  useEffect(() => {
    if (toolRequest?.requiresApproval) {
      setShowDropDown(true);
    }
  }, []);

  useEffect(() => {
    if (toolRunStatus === 'aborted') {
      setShowConsent(false);
      setShowDropDown(false);
    }
  }, [toolRunStatus]);

  const handleDropDown = () => {
    setShowDropDown(!showDropDown);
  };

  const handleAutoApprovalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setAutoApproval(newValue);
  };

  const highlighterStyle =
    themeKind === 'light' || themeKind === 'high-contrast-light' ? duotoneLight : dracula;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  // base tool chip
  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm">
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex w-full min-w-0 items-center gap-2">
              {/* Tool status icon */}
              <ToolStatusIcon status={toolRunStatus} />

              {/* Tool request display text */}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <span className="text-xs font-bold">
                  {requestRejected ? 'Tool Use Request Rejected' : displayText}
                </span>

                {/* In case of MCP tools. */}
                {toolRequest?.toolMeta && (
                  <span
                    className="truncate text-xs text-gray-400"
                    data-tooltip-id="tool-chip-tool-tip"
                    data-tooltip-content={`${toolRequest?.toolMeta.serverName}/${toolRequest?.toolMeta.toolName}`}
                    data-tooltip-place="top-start"
                  >
                    {toolRequest?.toolMeta.serverName}/{toolRequest?.toolMeta.toolName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto approval checkbox in case of MCP tools */}
            {toolRequest?.requiresApproval && (
              <div>
                {showConsent && (
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-xs text-gray-400">Auto approve</span>
                    <input
                      type="checkbox"
                      checked={autoApproval}
                      onChange={handleAutoApprovalChange}
                      className="h-4 w-4 rounded border-gray-500/40 bg-gray-500/10 text-blue-500 focus:ring-0"
                    />
                  </div>
                )}
              </div>
            )}

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
                  {JSON.stringify(toolRequest.requestData, null, 2)}
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

            {/* Consent for MCP tool use */}
            {toolRequest.requiresApproval && (
              <div>
                {showConsent && (
                  <div>
                    <div className="px-2 py-2 text-xs italic text-[--vscode-editorWarning-foreground]">
                      This tool requires your approval before it can be executed.
                    </div>
                    <div className="flex space-x-2 px-2 pb-2">
                      <button
                        onClick={() => {
                          toolUseApprovalUpdate(toolUseId, autoApproval, true);
                          setShowDropDown(false);
                          setShowConsent(false);
                        }}
                        className={`flex-1 rounded bg-green-600 px-2 py-2 font-semibold text-[--deputydev-button-foreground] hover:opacity-40 ${borderClass} disabled:cursor-progress disabled:opacity-80`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          toolUseApprovalUpdate(toolUseId, false, false);
                          setShowDropDown(false);
                          setShowConsent(false);
                          setRequestRejected(true);
                        }}
                        className={`flex-1 rounded bg-[--deputydev-button-secondaryBackground] px-2 py-2 font-semibold text-[--deputydev-button-secondaryForeground] text-red-500 hover:bg-[--deputydev-button-secondaryHoverBackground] ${borderClass} disabled:cursor-progress disabled:opacity-80`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <Tooltip id="tool-chip-tool-tip" />
      </div>
    </div>
  );
};

export default ChipBase;
