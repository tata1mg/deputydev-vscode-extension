import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { hitEmbedding, sendWorkspaceRepoChange } from '@/commandApi';
import { useChatStore } from '../../../stores/chatStore';
import { useIndexingStore } from '@/stores/indexingDataStore';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

const RepoSelector = () => {
  const { workspaceRepos, activeRepo, setActiveRepo } = useWorkspaceStore();
  const { history: messages, isLoading } = useChatStore();
  const { indexingProgressData } = useIndexingStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const disableRepoSelector = isLoading || messages.length > 0;
  const activeRepoData = workspaceRepos.find((repo) => repo.repoPath === activeRepo);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (repoPath: string) => {
    if (repoPath !== activeRepo) {
      setActiveRepo(repoPath);
      sendWorkspaceRepoChange({ repoPath });
    }
    setIsOpen(false);
  };

  const IndexingStatusIcon: React.FC = () => {
    const currentIndexingProgressData = indexingProgressData.find(
      (repo) => repo.repo_path === activeRepo
    );

    switch (currentIndexingProgressData?.status) {
      case 'IN_PROGRESS':
        return (
          <div className="flex h-3 w-3 items-center justify-center pl-1">
            <div className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_8px_2px_rgba(250,204,21,0.6)]" />
          </div>
        );
      case 'COMPLETED':
        return (
          <div className="flex h-3 w-3 items-center justify-center pl-1">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]" />
          </div>
        );
      case 'FAILED':
        return (
          <div className="flex h-3 w-3 items-center justify-center pl-1">
            <button
              className="inline-flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                hitEmbedding(activeRepo ?? '');
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <RefreshCw className="h-3 w-3 cursor-pointer text-red-400 hover:text-red-500" />
            </button>
          </div>
        );
      default:
        return <div className="h-3 w-3 pl-1" />;
    }
  };

  if (workspaceRepos.length === 0) {
    return (
      <div className="ml-1 flex items-center gap-2 rounded-full border border-[--vscode-commandCenter-inactiveBorder] px-2 py-0.5 text-xs opacity-50">
        No repositories
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={() => !disableRepoSelector && setIsOpen(!isOpen)}
              disabled={disableRepoSelector}
              className={`flex items-center gap-2 rounded-full border border-[--vscode-commandCenter-inactiveBorder] px-2 py-0.5 text-xs ${
                disableRepoSelector
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:bg-[var(--deputydev-input-background)]'
              }`}
            >
              <IndexingStatusIcon />
              <div className="flex items-center gap-1">
                <span className="max-w-[70px] truncate">
                  {activeRepoData?.repoName ?? 'Select Repo'}
                </span>
                <ChevronDown
                  className={`h-3 w-3 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              align="center"
              className="whitespace-nowrap rounded bg-[--vscode-toolbar-hoverBackground] px-2 py-1 text-xs text-[--vscode-foreground]"
            >
              {disableRepoSelector
                ? 'Create new chat to select new repo'
                : `${Math.round(
                    indexingProgressData.find((repo) => repo.repo_path === activeRepo)?.progress ??
                      0
                  )}% ${
                    indexingProgressData.find((repo) => repo.repo_path === activeRepo)?.status ===
                    'COMPLETED'
                      ? 'Indexed'
                      : indexingProgressData.find((repo) => repo.repo_path === activeRepo)
                            ?.status === 'COMPLETED'
                        ? 'Indexing Completed'
                        : indexingProgressData.find((repo) => repo.repo_path === activeRepo)
                              ?.status === 'FAILED'
                          ? 'Indexing Failed, Retry'
                          : 'Not indexed'
                  }`}
              <Tooltip.Arrow offset={10} className="fill-[--vscode-toolbar-hoverBackground]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1 w-full min-w-[160px] rounded-md border border-[--vscode-dropdown-border] bg-[--vscode-dropdown-background] shadow-lg"
          style={{
            maxHeight: '250px',
            overflowY: 'auto',
          }}
        >
          {workspaceRepos.map((repo) => (
            <button
              key={repo.repoPath}
              className={`flex w-full cursor-pointer items-center px-2 py-0.5 text-xs ${
                activeRepo === repo.repoPath
                  ? 'bg-[--vscode-list-activeSelectionBackground] text-[--vscode-list-activeSelectionForeground]'
                  : 'text-[--vscode-foreground] hover:bg-[--vscode-list-hoverBackground]'
              }`}
              onClick={() => handleSelect(repo.repoPath)}
            >
              <span className="flex-1 truncate text-left">{repo.repoName}</span>
              {activeRepo === repo.repoPath && <span className="ml-2 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RepoSelector;
