import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { sendWorkspaceRepoChange } from '@/commandApi';
import { useChatStore } from "../../../stores/chatStore";

const RepoSelector = () => {
  const { workspaceRepos, activeRepo, setActiveRepo } = useWorkspaceStore();
  const { history: messages, isLoading } = useChatStore();

  // The repo selector should be disabled if the repo is embedding, a response is pending, or there is chat history.
  const disableRepoSelector = isLoading || messages.length > 0;

  const tooltipProps: Partial<Record<string, string>> = disableRepoSelector
    ? {
        "data-tooltip-id": "repo-tooltip",
        "data-tooltip-content": "Create new chat to select new repo.",
      }
    : {};

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRepoPath = event.target.value;
    const selectedRepo = workspaceRepos.find(repo => repo.repoPath === selectedRepoPath);

    if (selectedRepo) {
      // console.log('selectedRepoPath', selectedRepoPath, 'selectedRepo', selectedRepo);
      setActiveRepo(selectedRepoPath);
      sendWorkspaceRepoChange({ repoPath: selectedRepoPath }); // Notify VS Code about the change
    }
  };

  return (
    <div
      {...tooltipProps} // Only applies tooltip if disabled
      className={`relative inline-flex  w-fit items-center gap-1 px-1 py-0.5 rounded text-sm border border-[--vscode-commandCenter-inactiveBorder]
                  ${disableRepoSelector ? 'opacity-50 p-0 cursor-not-allowed' : 'hover:bg-[var(--deputydev-input-background)] '}`}
    >
      <select
        className="w-full bg-inherit focus:outline-none  cursor-pointer  text-xs"
        value={activeRepo || ''}
        onChange={handleChange}
        disabled={disableRepoSelector}
      > 
        {workspaceRepos.length === 0 ? (
          <option value="" disabled>No repositories available</option>
        ) : (
          workspaceRepos.map(repo => (
            <option key={repo.repoPath} value={repo.repoPath}>
              {repo.repoName}
            </option>
          ))
        )}
      </select>
    </div>
  );
};

export default RepoSelector;
