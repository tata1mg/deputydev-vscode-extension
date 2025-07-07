import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { hitEmbedding, sendWorkspaceRepoChange } from '@/commandApi';
import { useChatStore } from '../../../stores/chatStore';
import { useIndexingStore } from '@/stores/indexingDataStore';
import { ChevronDown, RefreshCw, CirclePlus, CircleX } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

const RepoSelector = () => {
  const { workspaceRepos, activeRepo, setActiveRepo, contextRepositories } = useWorkspaceStore();
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
  };

  const removeRepoFromContext = (repoPath: string, repoName: string) => {
    useWorkspaceStore.setState({
      contextRepositories: contextRepositories.filter((repo) => repo.repoPath !== repoPath),
    });
    console.log(
      'Updated contextRepositories after removing',
      useWorkspaceStore.getState().contextRepositories
    );
  };

  const addRepoToContext = (repoPath: string, repoName: string) => {
    useWorkspaceStore.setState({
      contextRepositories: [...contextRepositories, { repoPath, repoName }],
    });
    console.log(
      'Updated contextRepositories after adding',
      useWorkspaceStore.getState().contextRepositories
    );
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
              className="whitespace-nowrap rounded px-2 py-1 text-xs"
              style={{
                backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                color: 'var(--vscode-editorHoverWidget-foreground)',
                border: '1px solid var(--vscode-editorHoverWidget-border)',
              }}
            >
              {!isOpen &&
                (disableRepoSelector
                  ? 'Create new chat to select new repo'
                  : `${Math.round(
                      indexingProgressData.find((repo) => repo.repo_path === activeRepo)
                        ?.progress ?? 0
                    )}% ${
                      indexingProgressData.find((repo) => repo.repo_path === activeRepo)?.status ===
                      'COMPLETED'
                        ? 'Indexing Completed'
                        : indexingProgressData.find((repo) => repo.repo_path === activeRepo)
                              ?.status === 'IN_PROGRESS'
                          ? 'Indexed'
                          : indexingProgressData.find((repo) => repo.repo_path === activeRepo)
                                ?.status === 'FAILED'
                            ? 'Indexing Failed, Retry'
                            : 'Indexed'
                    }`)}
              <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1 w-full min-w-[260px] rounded-md border border-[--vscode-dropdown-border] bg-[--vscode-dropdown-background] shadow-lg"
          style={{
            maxHeight: '250px',
            overflowY: 'auto',
          }}
        >
          {workspaceRepos.map((repo) => (
            <button
              key={repo.repoPath}
              className={`flex w-full cursor-pointer items-center px-2 py-1 text-xs ${
                activeRepo === repo.repoPath
                  ? 'bg-[--vscode-list-activeSelectionBackground] text-[--vscode-list-activeSelectionForeground]'
                  : 'text-[--vscode-foreground] hover:bg-[--vscode-list-hoverBackground]'
              }`}
              onClick={() => handleSelect(repo.repoPath)}
            >
              <span className="flex-1 truncate text-left">{repo.repoName}</span>
              {activeRepo === repo.repoPath && (
                <span className="ml-2 text-xs text-green-500 opacity-65">Active</span>
              )}
              {repo.repoPath !== activeRepo &&
                (contextRepositories.some((r) => r.repoPath === repo.repoPath) ? (
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <CircleX
                          className="ml-2 h-4 w-4 cursor-pointer text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRepoFromContext(repo.repoPath, repo.repoName);
                          }}
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="z-50 rounded-md px-2 py-1 text-xs"
                          side="top"
                          sideOffset={5}
                          style={{
                            backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                            color: 'var(--vscode-editorHoverWidget-foreground)',
                            border: '1px solid var(--vscode-editorHoverWidget-border)',
                          }}
                        >
                          Remove this repo from context
                          <Tooltip.Arrow
                            style={{ fill: 'var(--vscode-editorHoverWidget-background)' }}
                          />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                ) : (
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <CirclePlus
                          className="ml-2 h-4 w-4 cursor-pointer text-green-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            addRepoToContext(repo.repoPath, repo.repoName);
                          }}
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="z-50 rounded-md px-2 py-1 text-xs"
                          side="top"
                          sideOffset={5}
                          style={{
                            backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                            color: 'var(--vscode-editorHoverWidget-foreground)',
                            border: '1px solid var(--vscode-editorHoverWidget-border)',
                          }}
                        >
                          Add this repo to context
                          <Tooltip.Arrow
                            style={{ fill: 'var(--vscode-editorHoverWidget-background)' }}
                          />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                ))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RepoSelector;
