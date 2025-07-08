import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { hitEmbedding, sendWorkspaceRepoChange } from '@/commandApi';
import { useChatStore } from '../../../stores/chatStore';
import { useIndexingStore } from '@/stores/indexingDataStore';
import { ChevronDown, RefreshCw, Square, Check, Info } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';

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
      useWorkspaceStore.setState({ contextRepositories: [] });
      setActiveRepo(repoPath);
      sendWorkspaceRepoChange({ repoPath });
    }
  };

  const handleClearAll = () => {
    if (!activeRepo) {
      useWorkspaceStore.setState({ contextRepositories: [] });
      return;
    }
    useWorkspaceStore.setState((state) => ({
      contextRepositories: state.contextRepositories.filter((repo) => repo.repoPath === activeRepo),
    }));
  };

  const handleSelectAll = () => {
    useWorkspaceStore.setState({ contextRepositories: workspaceRepos });
  };

  const removeRepoFromContext = (repoPath: string, repoName: string) => {
    useWorkspaceStore.setState({
      contextRepositories: contextRepositories.filter((repo) => repo.repoPath !== repoPath),
    });
  };

  const addRepoToContext = (repoPath: string, repoName: string) => {
    useWorkspaceStore.setState({
      contextRepositories: [...contextRepositories, { repoPath, repoName }],
    });
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
            <motion.button
              onClick={() => !disableRepoSelector && setIsOpen(!isOpen)}
              disabled={disableRepoSelector}
              className={`flex items-center gap-2 rounded-full border border-[--vscode-commandCenter-inactiveBorder] px-1 py-0.5 text-xs ${
                disableRepoSelector
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:bg-[var(--deputydev-input-background)]'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <IndexingStatusIcon />
              <div className="flex items-center gap-1">
                <span className="max-w-[70px] truncate">
                  {activeRepoData?.repoName ?? 'Select Repo'}
                </span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </motion.span>
              </div>
            </motion.button>
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              mass: 0.5,
            }}
            className="absolute bottom-full left-0 right-0 z-50 mx-auto mb-1 w-[180%] origin-bottom rounded-md border border-[--vscode-dropdown-border] bg-[--vscode-dropdown-background] shadow-lg"
          >
            <motion.div
              className="flex items-center justify-between py-1 pl-2 pr-1"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="text-xs">Select to add in context</span>
              <Info className="h-4 w-4 opacity-50 transition-opacity hover:bg-slate-700 hover:bg-opacity-10 hover:opacity-100" />
            </motion.div>
            <motion.div
              className="flex w-full items-center justify-end gap-2 border-t border-t-[var(--vscode-editorWidget-border)] py-1 pl-2 pr-1"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <span
                className="cursor-pointer text-[8px] text-[--vscode-descriptionForeground] transition-colors hover:text-[--vscode-foreground]"
                onClick={handleClearAll}
              >
                Clear All
              </span>
              <span
                className="cursor-pointer text-[8px] text-[--vscode-descriptionForeground] transition-colors hover:text-[--vscode-foreground]"
                onClick={handleSelectAll}
              >
                Select All
              </span>
            </motion.div>
            <motion.div
              style={{
                maxHeight: '250px',
                overflowY: 'auto',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {workspaceRepos.map((repo, index) => (
                <motion.button
                  key={repo.repoPath}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + index * 0.02 }}
                  className={`flex w-full cursor-pointer items-center py-1 pl-2 pr-1 text-xs ${
                    activeRepo === repo.repoPath
                      ? 'bg-[--vscode-list-activeSelectionBackground] text-[--vscode-list-activeSelectionForeground]'
                      : 'text-[--vscode-foreground] hover:bg-[--vscode-list-hoverBackground]'
                  }`}
                  onClick={() => handleSelect(repo.repoPath)}
                >
                  <span className="flex-1 truncate text-left">{repo.repoName}</span>
                  {activeRepo === repo.repoPath && (
                    <div className="ml-2 flex max-h-4 items-center justify-center rounded-sm border border-green-600 bg-green-600 p-0.5 text-[8px]">
                      <span>ACTIVE</span>
                    </div>
                  )}
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <div className="relative ml-2 h-5 w-5">
                          {repo.repoPath === activeRepo ? (
                            <div className="h-5 w-5 opacity-50">
                              <Square className="absolute h-5 w-5 text-gray-400" />
                              <Check className="absolute left-0.5 top-0.5 h-4 w-4 text-green-400" />
                            </div>
                          ) : (
                            <div className="cursor-pointer">
                              <Square className="absolute h-5 w-5 text-gray-400" />
                              {contextRepositories.some((r) => r.repoPath === repo.repoPath) && (
                                <Check className="absolute left-0.5 top-0.5 h-4 w-4 text-green-400" />
                              )}
                              <div
                                className="absolute inset-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    contextRepositories.some((r) => r.repoPath === repo.repoPath)
                                  ) {
                                    removeRepoFromContext(repo.repoPath, repo.repoName);
                                  } else {
                                    addRepoToContext(repo.repoPath, repo.repoName);
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
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
                          {repo.repoPath === activeRepo
                            ? 'Active repository is always in context'
                            : contextRepositories.some((r) => r.repoPath === repo.repoPath)
                              ? 'Remove this repo from context'
                              : 'Add this repo to context'}
                          <Tooltip.Arrow
                            style={{ fill: 'var(--vscode-editorHoverWidget-background)' }}
                          />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RepoSelector;
