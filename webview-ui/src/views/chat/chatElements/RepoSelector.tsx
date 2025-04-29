import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { sendWorkspaceRepoChange } from '@/commandApi';
import { useChatStore } from "../../../stores/chatStore";
import * as Tooltip from '@radix-ui/react-tooltip'; // Import Radix Tooltip components

const RepoSelector = () => {
  const { workspaceRepos, activeRepo, setActiveRepo } = useWorkspaceStore();
  const { history: messages, isLoading } = useChatStore();

  // Determine if the selector should be disabled
  const disableRepoSelector = isLoading || messages.length > 0;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRepoPath = event.target.value;
    const selectedRepo = workspaceRepos.find(repo => repo.repoPath === selectedRepoPath);

    if (selectedRepo) {
      setActiveRepo(selectedRepoPath);
      sendWorkspaceRepoChange({ repoPath: selectedRepoPath }); // Notify VS Code about the change
    }
  };

  // Common class names for the wrapper div
  const wrapperBaseClasses = `relative inline-flex w-fit items-center gap-1 px-1 py-0.5 rounded text-sm border border-[--vscode-commandCenter-inactiveBorder]`;
  // Conditional classes based on the disabled state
  const wrapperConditionalClasses = disableRepoSelector
    ? 'opacity-50 p-0 cursor-not-allowed' // Disabled styles
    : 'hover:bg-[var(--deputydev-input-background)]'; // Enabled hover style

  const selectElement = (
      <select
        className="w-full bg-inherit focus:outline-none cursor-pointer text-xs"
        value={activeRepo || ''}
        onChange={handleChange}
        disabled={disableRepoSelector}
        // Add pointer-events: none specifically to the select when disabled
        // to ensure the wrapper div receives hover events for the tooltip trigger.
        style={disableRepoSelector ? { pointerEvents: 'none' } : {}}
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
  );

  // If the selector is disabled, wrap it with the Radix Tooltip
  if (disableRepoSelector) {
    return (
      <Tooltip.Provider delayDuration={200}> {/* Optional: Add a small delay */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            {/* The trigger is the wrapper div */}
            <div className={`${wrapperBaseClasses} ${wrapperConditionalClasses}`}>
              {selectElement}
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top" // Or "bottom", "left", "right"
              align="center" // Adjust alignment as needed
              className="max-w-[300px] break-words rounded-md px-2 py-1.5 ml-3 text-xs shadow-md z-50" // Added z-index just in case
              style={{
                backgroundColor: "var(--vscode-editorHoverWidget-background)",
                color: "var(--vscode-editorHoverWidget-foreground)",
                border: "1px solid var(--vscode-editorHoverWidget-border)",
              }}
            >
              Create new chat to select new repo.
              <Tooltip.Arrow
                style={{ fill: "var(--vscode-editorHoverWidget-background)" }}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }

  // If the selector is enabled, render it without the tooltip wrapper
  return (
    <div className={`${wrapperBaseClasses} ${wrapperConditionalClasses}`}>
      {selectElement}
    </div>
  );
};

export default RepoSelector;