import { ChevronDown, ChevronUp, CircleX, CircleCheckBig } from 'lucide-react';
import { useState } from 'react';

export default function ChangedFilesBar() {
  const [showAllChangedFiles, setShowAllChangedFiles] = useState(false);

  const handleAcceptAllFiles = () => {};

  const handleRejectAllFiles = () => {};

  const handleAcceptFile = () => {};

  const handleRejectFile = () => {};

  return (
    <div className="flex justify-center pl-3 pr-3">
      <div
        className="flex w-full flex-col rounded-t-md border-l-2 border-r-2 border-t-2 border-gray-700"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
        }}
      >
        {showAllChangedFiles && (
          <div
            className="flex max-h-[150px] overflow-y-auto p-2"
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
            }}
          >
            <div className="flex w-full items-center justify-between">
              <button className="flex min-w-0 flex-1 items-center">
                <div className="flex w-full min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm">
                      codeActionPanelFileEdit.tsx
                    </span>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-green-500">+12</span>
                      <span className="text-red-500">-20</span>
                    </div>
                  </div>
                  <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs text-gray-500">
                    chat/chatElements/codeActionPanelFileEdit.tsx
                  </span>
                </div>
              </button>
              <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                <CircleCheckBig className="h-5 w-5 text-green-500" />
                <CircleX className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </div>
        )}
        <div className="m-1.5 flex items-center justify-between gap-2">
          <button
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
            onClick={() => setShowAllChangedFiles(!showAllChangedFiles)}
          >
            {showAllChangedFiles ? (
              <ChevronDown className="flex-shrink-0" />
            ) : (
              <ChevronUp className="flex-shrink-0" />
            )}
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
              23 files changed
            </div>
          </button>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              className="whitespace-nowrap border border-green-500 p-[2px] text-xs text-green-500"
              onClick={() => {
                handleAcceptAllFiles();
              }}
            >
              Accept All
            </button>
            <button
              className="whitespace-nowrap border border-red-600 p-[2px] text-xs text-red-600"
              onClick={() => {
                handleRejectAllFiles();
              }}
            >
              Reject All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
