import { BaseToolProps } from '@/types';
import React, { useEffect } from 'react';
import { CheckCircle, Loader2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ToolRunStatus } from '@/types';
import { useState } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';
import { toolUseApprovalUpdate } from '@/commandApi';

const StatusIcon: React.FC<{ status: ToolRunStatus }> = ({ status }) => {
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

const BaseTool: React.FC<BaseToolProps> = ({
  toolRunStatus,
  toolRequest,
  toolResponse,
  toolUseId,
}) => {
  const { themeKind } = useThemeStore();
  const borderClass =
    themeKind === 'high-contrast' || themeKind === 'high-contrast-light'
      ? 'border border-[--deputydev-button-border]'
      : '';
  const [showDropDown, setShowDropDown] = useState(false);
  const [autoApproval, setAutoApproval] = useState(false);
  const [showConsent, setShowConsent] = useState(true);

  useEffect(() => {
    console.log("***************", toolRequest?.requiresApproval)
    if (toolRequest?.requiresApproval) {
      setShowDropDown(true);
    }
  }, [])

  const handleDropDown = () => {
    setShowDropDown(!showDropDown);
  };

  const handleAutoApprovalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setAutoApproval(newValue);
  };

  // base tool chip
  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm">
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon status={toolRunStatus} />
              <div className="flex flex-col">
                <span className="text-md">{toolRequest?.toolMeta.serverName}</span>
                <span className="text-xs text-gray-400">{toolRequest?.toolMeta.toolName}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {toolRequest?.requiresApproval && (
              <div>
                {showConsent &&
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Auto approve</span>
                    <input
                      type="checkbox"
                      checked={autoApproval}
                      onChange={handleAutoApprovalChange}
                      className="h-4 w-4 rounded border-gray-500/40 bg-gray-500/10 text-blue-500 focus:ring-0"
                    />
                  </div>
                }
              </div>
            )}
            <div className="cursor-pointer" onClick={() => handleDropDown()}>
              {!showDropDown ? <ChevronDown /> : <ChevronUp />}
            </div>
          </div>
        </div>
        {showDropDown && toolRequest && (
          <div className="space-y-4">
            <div className="overflow-x-hidden rounded bg-gray-500/10 p-2">
              <div className="mb-2 font-semibold">Ran with these arguments:</div>
              <div className="word-break: max-h-[200px] w-full overflow-y-auto whitespace-pre-wrap break-all text-xs">
                {JSON.stringify(toolRequest.requestData, null, 2)}
              </div>
            </div>
            {toolResponse && (
              <div className="overflow-x-hidden rounded bg-gray-500/10 p-2">
                <div className="mb-2 font-semibold">Output</div>
                <div className="word-break: max-h-[200px] w-full overflow-y-auto whitespace-pre-wrap break-all text-xs">
                  {JSON.stringify(toolResponse, null, 2)}
                </div>
              </div>
            )}
            {toolRequest.requiresApproval && (
              <div>
                {showConsent &&
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
                        }}
                        className={`flex-1 rounded bg-[--deputydev-button-secondaryBackground] px-2 py-2 font-semibold text-[--deputydev-button-secondaryForeground] text-red-500 hover:bg-[--deputydev-button-secondaryHoverBackground] ${borderClass} disabled:cursor-progress disabled:opacity-80`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseTool;
