import {
  acceptAllChangesInFile,
  acceptAllChangesInSession,
  openDiffViewer,
  rejectAllChangesInFile,
  rejectAllChangesInSession,
} from '@/commandApi';
import { useChangedFilesStore } from '@/stores/changedFilesStore';
import { ChevronDown, ChevronUp, CircleX, CircleCheckBig } from 'lucide-react';
import { useState } from 'react';

export default function ChangedFilesBar() {
  const { changedFiles, filesChangedSessionId } = useChangedFilesStore();
  const [showAllChangedFiles, setShowAllChangedFiles] = useState(false);

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
            {changedFiles && changedFiles.length > 0 && (
              <div className="flex w-full flex-col gap-1">
                {changedFiles.map((file, index) => (
                  <div key={index} className="flex w-full items-center justify-between">
                    <button
                      className="flex min-w-0 flex-1 items-center"
                      onClick={() => openDiffViewer(file.filePath, file.repoPath)}
                    >
                      <div className="flex w-full min-w-0 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm">
                            {file.fileName}
                          </span>
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-green-500">+{file.addedLines}</span>
                            <span className="text-red-500">-{file.removedLines}</span>
                          </div>
                        </div>
                        <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-xs text-gray-500">
                          {file.filePath}
                        </span>
                      </div>
                    </button>
                    <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                      <CircleCheckBig
                        className="h-5 w-5 cursor-pointer text-green-500"
                        onClick={() => acceptAllChangesInFile(file.filePath, file.repoPath)}
                      />
                      <CircleX
                        className="h-5 w-5 cursor-pointer text-red-600"
                        onClick={() => rejectAllChangesInFile(file.filePath, file.repoPath)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              {changedFiles.length} {changedFiles.length === 1 ? 'file changed' : 'files changed'}
            </div>
          </button>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              className="whitespace-nowrap border border-green-500 p-[2px] text-xs text-green-500"
              onClick={() => {
                acceptAllChangesInSession(filesChangedSessionId);
              }}
            >
              Accept All
            </button>
            <button
              className="whitespace-nowrap border border-red-600 p-[2px] text-xs text-red-600"
              onClick={() => {
                rejectAllChangesInSession(filesChangedSessionId);
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
