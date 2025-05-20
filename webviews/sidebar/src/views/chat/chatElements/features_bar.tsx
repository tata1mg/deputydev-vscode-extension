import { createOrOpenFile } from '@/commandApi';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Hammer, RefreshCw, FilePenLine, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Tooltip } from 'react-tooltip';

const servers = [
  {
    name: 'create_or_update_file',
    description: 'Create or update a single file in a GitHub repository',
  },
  {
    name: 'search_repositories',
    description: 'Search for GitHub repositories',
  },
  {
    name: 'create_repository',
    description: 'Create a new GitHub repository in your account',
  },
  {
    name: 'get_file_contents',
    description: 'Get the contents of a file or directory from a GitHub repository',
  },
  {
    name: 'push_files',
    description: 'Push multiple files to a GitHub repository in a single commit',
  },
  {
    name: 'create_issue',
    description: 'Create a new issue in a GitHub repository',
  },
  {
    name: 'create_pull_request',
    description: 'Create a new pull request in a GitHub repository',
  },
  {
    name: 'fork_repository',
    description: 'Fork a GitHub repository to your account or specified organization',
  },
  {
    name: 'create_branch',
    description: 'Create a new branch in a GitHub repository',
  },
  {
    name: 'list_commits',
    description: 'Get list of commits of a branch in a GitHub repository',
  },
  {
    name: 'list_issues',
    description: 'List issues in a GitHub repository with filtering options',
  },
  {
    name: 'update_issue',
    description: 'Update an existing issue in a GitHub repository',
  },
  {
    name: 'add_issue_comment',
    description: 'Add a comment to an existing issue',
  },
  {
    name: 'search_code',
    description: 'Search for code across GitHub repositories',
  },
  {
    name: 'search_issues',
    description: 'Search for issues and pull requests across GitHub repositories',
  },
  {
    name: 'search_users',
    description: 'Search for users on GitHub',
  },
  {
    name: 'get_issue',
    description: 'Get details of a specific issue in a GitHub repository.',
  },
  {
    name: 'get_pull_request',
    description: 'Get details of a specific pull request',
  },
  {
    name: 'list_pull_requests',
    description: 'List and filter repository pull requests',
  },
  {
    name: 'create_pull_request_review',
    description: 'Create a review on a pull request',
  },
  {
    name: 'merge_pull_request',
    description: 'Merge a pull request',
  },
  {
    name: 'get_pull_request_files',
    description: 'Get the list of files changed in a pull request',
  },
  {
    name: 'get_pull_request_status',
    description: 'Get the combined status of all status checks for a pull request',
  },
  {
    name: 'update_pull_request_branch',
    description: 'Update a pull request branch with the latest changes from the base branch',
  },
  {
    name: 'get_pull_request_comments',
    description: 'Get the review comments on a pull request',
  },
  {
    name: 'get_pull_request_reviews',
    description: 'Get the reviews on a pull request',
  },
];

export default function FeaturesBar() {
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const [showAllMCPServers, setShowAllMCPServers] = useState(false);
  const [showMCPServerTools, setShowMCPServerTools] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const { activeRepo } = useWorkspaceStore();

  const handleShowMCPServers = () => {
    setShowAllMCPServers(!showAllMCPServers);
    setShowMCPServerTools(false);
  };

  const handleShowMCPTools = () => {
    setShowMCPServerTools(!showMCPServerTools);
  };

  const handleRefreshMCPServers = () => {
    console.log('***********Refersh MCP Servers*************');
    setRefreshSpinning(true);
    setTimeout(() => setRefreshSpinning(false), 1000);
  };

  const openMCPConfig = () => {
    const filePath = `${activeRepo}/.mcp_settings.json`;
    createOrOpenFile(filePath);
  };

  const handleBack = () => {
    if (showMCPServerTools) {
      setShowMCPServerTools(false);
      return;
    }

    if (showAllMCPServers) {
      setShowAllMCPServers(false);
      return;
    }
  };

  return (
    <div className="flex justify-center pl-3 pr-3">
      <div className="flex w-full flex-col rounded-t-md border-l-2 border-r-2 border-t-2 border-gray-700">
        {showAllMCPServers && (
          <div className="flex justify-between bg-gray-500/20 hover:bg-slate-600">
            <button
              className="flex items-center gap-2 px-2 py-1"
              onClick={() => handleShowMCPTools()}
            >
              {/* Green Dot with Glow */}
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]" />

              {/* Yellow Dot with Glow */}
              {/* <div className="h-4 w-4 rounded-full bg-yellow-400 shadow-[0_0_8px_2px_rgba(250,204,21,0.6)]" /> */}

              {/* Red Dot with Glow */}
              {/* <div className="h-4 w-4 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" /> */}
              <div>Github 26 Tools</div>
            </button>
            <div className="mr-2 flex items-center space-x-2">
              <button
                onClick={() => setEnabled(!enabled)}
                className={`flex h-4 w-8 items-center rounded-full p-1 transition-colors duration-300 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div
                  className={`h-3 w-3 transform rounded-full bg-white shadow-md duration-300 ${enabled ? 'translate-x-3' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>
        )}

        {showMCPServerTools && showAllMCPServers && (
          <div
            className="h-full max-h-[150px] overflow-y-auto bg-transparent p-2 transition-all duration-300 ease-out"
            style={{
              opacity: showMCPServerTools ? 1 : 0,
              maxHeight: showMCPServerTools ? '150px' : '0',
              transition: 'max-height 0.3s ease-out, opacity 0.3s ease-out',
            }}
          >
            {servers.map((item, index) => (
              <div key={index} className="mb-2 flex flex-col">
                <div className="text-xs">{item.name}</div>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        )}

        <div className="m-1.5 flex justify-between">
          <div className="flex items-center gap-2">
            {(showAllMCPServers || showMCPServerTools) && (
              <button>
                <ArrowLeft
                  className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5"
                  onClick={() => handleBack()}
                />
              </button>
            )}
            <button className="flex items-center gap-2" onClick={() => handleShowMCPServers()}>
              <Hammer className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5" />
              <div className="text-xs">3 Available MCP Servers</div>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw
              className={`h-4 w-4 hover:cursor-pointer hover:bg-slate-400 hover:bg-opacity-10 ${refreshSpinning && 'animate-spin'}`}
              onClick={() => handleRefreshMCPServers()}
            />
            <FilePenLine
              className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5"
              onClick={() => openMCPConfig()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
