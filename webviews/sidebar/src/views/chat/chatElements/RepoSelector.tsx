import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { sendWorkspaceRepoChange } from '@/commandApi';
import { useChatStore } from '../../../stores/chatStore';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useIndexingStore } from '@/stores/indexingDataStore';

const RepoSelector = () => {
  const { workspaceRepos, activeRepo, setActiveRepo } = useWorkspaceStore();
  const { history: messages, isLoading } = useChatStore();
  const { IndexingProgressData } = useIndexingStore();

  const disableRepoSelector = isLoading || messages.length > 0;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRepoPath = event.target.value;
    const selectedRepo = workspaceRepos.find((repo) => repo.repoPath === selectedRepoPath);

    if (selectedRepo) {
      setActiveRepo(selectedRepoPath);
      sendWorkspaceRepoChange({ repoPath: selectedRepoPath });
    }
  };

  const IndexingStatusIcon: React.FC = () => {
    const indexingProgressData = IndexingProgressData.find((repo) => repo.repo_path === activeRepo);
    switch (indexingProgressData?.status) {
      case 'In Progress':
        return (
          <div className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_8px_2px_rgba(250,204,21,0.6)]" />
        );
      case 'Completed':
        return (
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]" />
        );
      case 'Failed':
        return (
          <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
        );
      default:
        return null;
    }
  };

  const tooltipContent = () => {
    const indexingProgressData = IndexingProgressData.find((repo) => repo.repo_path === activeRepo);
    switch (indexingProgressData?.status) {
      case 'In Progress':
        return `${Math.round(indexingProgressData?.progress ?? 0)}% Indexed`;
      case 'Completed':
        return 'Indexing Completed';
      case 'Failed':
        return 'Indexing Failed';
      default:
        return 'Not indexed';
    }
  };

  const selectElement = (
    <div className="relative w-full">
      <select
        className="w-[100px] cursor-pointer appearance-none text-ellipsis whitespace-nowrap bg-inherit pl-4 text-xs focus:outline-none"
        value={activeRepo ?? ''}
        onChange={handleChange}
        disabled={disableRepoSelector}
        style={disableRepoSelector ? { pointerEvents: 'none' } : {}}
      >
        {workspaceRepos.length === 0 ? (
          <option value="" disabled>
            No repositories
          </option>
        ) : (
          workspaceRepos.map((repo) => (
            <option key={repo.repoPath} value={repo.repoPath}>
              {repo.repoName}
            </option>
          ))
        )}
      </select>
      <div className="absolute left-0.5 top-1/2 -translate-y-1/2 cursor-pointer">
        <IndexingStatusIcon />
      </div>
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            className={`relative inline-flex w-fit items-center gap-1 rounded-full border border-[--vscode-commandCenter-inactiveBorder] px-1 py-0.5 text-xs ${
              disableRepoSelector ? 'opacity-50' : 'hover:bg-[var(--deputydev-input-background)]'
            }`}
          >
            {selectElement}
          </div>
        </Tooltip.Trigger>
        {disableRepoSelector ? (
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              align="center"
              className="z-50 ml-3 max-w-[300px] break-words rounded-md px-2 py-1.5 text-xs shadow-md"
              style={{
                backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                color: 'var(--vscode-editorHoverWidget-foreground)',
                border: '1px solid var(--vscode-editorHoverWidget-border)',
              }}
            >
              Create new chat to select new repo.
              <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        ) : (
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              align="center"
              className="z-50 ml-3 max-w-[300px] break-words rounded-md px-2 py-1.5 text-xs shadow-md"
              style={{
                backgroundColor: 'var(--vscode-editorHoverWidget-background)',
                color: 'var(--vscode-editorHoverWidget-foreground)',
                border: '1px solid var(--vscode-editorHoverWidget-border)',
              }}
            >
              {tooltipContent()}
              <Tooltip.Arrow style={{ fill: 'var(--vscode-editorHoverWidget-background)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default RepoSelector;
