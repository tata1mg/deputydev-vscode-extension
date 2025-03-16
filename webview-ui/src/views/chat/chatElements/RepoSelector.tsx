import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { sendWorkspaceRepoChange } from '@/commandApi';

type RepoSelectorProps = {
  disabled: boolean;
  tooltipProps?: Partial<Record<string, string>>;
};

const RepoSelector = ({ disabled, tooltipProps }: RepoSelectorProps) => {
  const { workspaceRepos, activeRepo, setActiveRepo } = useWorkspaceStore();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRepoPath = event.target.value;
    const selectedRepo = workspaceRepos.find(repo => repo.repoPath === selectedRepoPath);

    if (selectedRepo) {
      console.log('selectedRepoPath', selectedRepoPath, 'selectedRepo', selectedRepo);
      setActiveRepo(selectedRepoPath);
      sendWorkspaceRepoChange({ repoPath: selectedRepoPath }); // Notify VS Code about the change
    }
  };

  return (
    <div
      {...(tooltipProps || {})} // Ensures tooltipProps is always an object
      className={`relative inline-flex items-center gap-1 px-1 py-1 border rounded w-full  text-sm
                  ${disabled ? 'opacity-50 p-0 cursor-not-allowed' : 'hover:bg-[var(--deputydev-input-background)]'}`}
    >
      <select
        className="bg-transparent  w-full cursor-pointer outline-none text-xs"
        value={activeRepo || ''}
        onChange={handleChange}
        disabled={disabled} // Ensures the select box is also disabled when needed
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
