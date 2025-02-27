import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { sendWorkspaceRepoChange } from '@/commandApi';

const RepoSelector = () => {
  const { workspaceRepos, activeRepo, setActiveRepo } = useWorkspaceStore();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRepoPath = event.target.value;
    const selectedRepo = workspaceRepos.find(repo => repo.repoPath === selectedRepoPath);

    if (selectedRepo) {
        console.log('selectedRepoPath', selectedRepoPath , 'selectedRepo', selectedRepo);
      setActiveRepo(selectedRepoPath);
      sendWorkspaceRepoChange({repoPath: selectedRepoPath}); // Notify VS Code about the change
    }
  };

  return (
    <div className="inline-flex items-center gap-1 px-1 py-1 border rounded w-full text-white text-sm  cursor-pointer hover:bg-neutral-700">
      <select
        className="bg-transparent text-white w-full cursor-pointer outline-none text-xs"
        value={activeRepo || ''}
        onChange={handleChange}
      >
        {workspaceRepos.length === 0 ? (
          <option value="" disabled>No repositories available</option>
        ) : (
          workspaceRepos.map(repo => (
            <option  key={repo.repoPath} value={repo.repoPath}>
              {repo.repoName}
            </option>
          ))
        )}
      </select>
    </div>
  );
};

export default RepoSelector;
