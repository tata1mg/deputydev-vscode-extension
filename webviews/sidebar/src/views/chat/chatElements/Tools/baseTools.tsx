import { BaseToolProps } from '@/types';
import React from 'react';
import { CheckCircle, Loader2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ToolRunStatus } from '@/types';
import { useState } from 'react';

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

const BaseTool: React.FC<BaseToolProps> = ({ toolRunStatus, toolRequest, toolResponse }) => {
  const [showDropDown, setShowDropDown] = useState(false);
  const handleDropDown = () => {
    setShowDropDown(!showDropDown);
  };

  return (
    <div className="mt-2 w-full rounded border border-gray-500/40 px-2 py-2 text-sm">
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusIcon status={toolRunStatus} />
            <span>{toolRequest?.toolName}</span>
          </div>
          <div className="cursor-pointer" onClick={() => handleDropDown()}>
            {!showDropDown ? <ChevronDown /> : <ChevronUp />}
          </div>
        </div>
        {showDropDown && toolRequest && (
          <div className="space-y-4">
            <div className="rounded bg-gray-500/10 p-2">
              <div className="mb-2 font-semibold">Request</div>
              <div className="whitespace-pre-wrap text-xs">
                {JSON.stringify(toolRequest, null, 2)}
              </div>
            </div>
            {toolResponse && (
              <div className="rounded bg-gray-500/10 p-2">
                <div className="mb-2 font-semibold">Response</div>
                <div className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(toolResponse, null, 2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseTool;
