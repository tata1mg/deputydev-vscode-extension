import {
  acceptAllChangesInFile,
  acceptAllChangesInSession,
  openDiffViewer,
  rejectAllChangesInFile,
  rejectAllChangesInSession,
} from '@/commandApi';
import { groupChangedFiles, useChangedFilesStore } from '@/stores/changedFilesStore';
import { useChatStore } from '@/stores/chatStore';
import { ChevronDown, ChevronUp, CircleCheckBig, CircleX } from 'lucide-react';
import { useRef, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { useClickAway } from 'react-use';

export default function ChangedFilesBar() {
  const changedFiles = useChangedFilesStore((state) => state.changedFiles);
  const { deleteFilesBySessionId } = useChangedFilesStore();
  const chatStore = useChatStore();
  const currentChat = chatStore.getCurrentChat();

  const [showAllChangedFiles, setShowAllChangedFiles] = useState(false);
  const changedFilesBar = useRef<HTMLDivElement>(null);
  const currentSessionId = currentChat?.sessionId;
  const groupedChangedFiles = groupChangedFiles(changedFiles);
  useClickAway(changedFilesBar, () => {
    setShowAllChangedFiles(false);
  });
  async function applyAllChangesInSession(type: 'accept' | 'reject') {
    const actionFn = type === 'accept' ? acceptAllChangesInSession : rejectAllChangesInSession;

    if (currentSessionId) {
      await actionFn(currentSessionId);
      deleteFilesBySessionId(currentSessionId);
    }
  }

  return (
    <div className="z-30 flex justify-center rounded-t-md pl-3 pr-3">
      <div
        ref={changedFilesBar}
        className="flex w-full flex-col rounded-t-md border border-b-[0.5px] border-[var(--vscode-editorWidget-border)]"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
        }}
      >
        {showAllChangedFiles && (
          <div
            className="flex max-h-[180px] flex-col overflow-y-auto rounded-t-md p-2"
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
            }}
          >
            {groupedChangedFiles && groupedChangedFiles.length > 0 && (
              <div className="flex w-full flex-col gap-2">
                {groupedChangedFiles.map((group) => (
                  <div key={group.sessionId} className="flex w-full flex-col gap-1">
                    {/* Files inside this group */}
                    {group.files.map((file) => (
                      <div
                        key={file.filePath}
                        className="flex w-full items-center justify-between border-b border-[var(--vscode-editorWidget-border)] pb-1 last:border-none"
                      >
                        <button
                          className="flex min-w-0 flex-1 items-center hover:opacity-70"
                          onClick={() => openDiffViewer(file.filePath, file.repoPath)}
                          data-tooltip-id="changed-files-tooltips"
                          data-tooltip-content={`Open diff for ${file.fileName}`}
                          data-tooltip-place="top-start"
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
                            className="h-5 w-5 cursor-pointer text-green-500 hover:opacity-70"
                            onClick={() =>
                              acceptAllChangesInFile(file.filePath, file.repoPath, file.sessionId)
                            }
                            data-tooltip-id="changed-files-tooltips"
                            data-tooltip-content="Accept changes"
                            data-tooltip-place="top-start"
                          />
                          <CircleX
                            className="h-5 w-5 cursor-pointer text-red-600 hover:opacity-70"
                            onClick={() =>
                              rejectAllChangesInFile(file.filePath, file.repoPath, file.sessionId)
                            }
                            data-tooltip-id="changed-files-tooltips"
                            data-tooltip-content="Reject changes"
                            data-tooltip-place="top-start"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="m-1.5 flex items-center justify-between gap-2">
          <button
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
            onClick={() => setShowAllChangedFiles((prev) => !prev)}
          >
            {showAllChangedFiles ? (
              <ChevronDown className="flex-shrink-0" />
            ) : (
              <ChevronUp className="flex-shrink-0" />
            )}
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
              {groupedChangedFiles.reduce((count, group) => count + group.files.length, 0)}{' '}
              {groupedChangedFiles.reduce((count, group) => count + group.files.length, 0) === 1
                ? 'file changed'
                : 'files changed'}
            </div>
          </button>
          <div className="flex flex-shrink-0 items-center gap-3">
            <button
              className="whitespace-nowrap rounded-md border border-green-500 p-1 text-xs text-green-500 hover:bg-green-500 hover:text-white"
              onClick={() => applyAllChangesInSession('accept')}
              data-tooltip-id="changed-files-tooltips"
              data-tooltip-content="Accept all changes"
              data-tooltip-place="top-start"
            >
              Accept All
            </button>
            <button
              className="whitespace-nowrap rounded-md border border-red-600 p-1 text-xs text-red-600 hover:bg-red-600 hover:text-white"
              onClick={() => applyAllChangesInSession('reject')}
              data-tooltip-id="changed-files-tooltips"
              data-tooltip-content="Reject all changes"
              data-tooltip-place="top-start"
            >
              Reject All
            </button>
          </div>
        </div>

        <Tooltip id="changed-files-tooltips" />
      </div>
    </div>
  );
}
