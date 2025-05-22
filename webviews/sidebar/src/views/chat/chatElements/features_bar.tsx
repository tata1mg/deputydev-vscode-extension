import { mcpServerEnableOrDisable, mcpServerRestart, openMcpSettings, syncServers } from '@/commandApi';
import { useMcpStore } from '@/stores/mcpStore';
import { MCPServer } from '@/types';
import { Hammer, RefreshCw, FilePenLine, ArrowLeft, CircleHelp, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Tooltip } from 'react-tooltip';

const MCPCircleHelpTooltipContent =
  'MCP grants DeputyDev to custom tools, click Configure icon to get started with setup.';

const MCPServerStatus: React.FC<{ mcpServerStatus: string }> = ({ mcpServerStatus }) => {
  switch (mcpServerStatus) {
    case 'pending':
      return (
        <div className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_8px_2px_rgba(250,204,21,0.6)]" />
      );
    case 'connected':
      return (
        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]" />
      );
    case 'disconnected':
      return (
        <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
      );
    default:
      return null;
  }
};

export default function FeaturesBar() {
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showAllMCPServers, setShowAllMCPServers] = useState(false);
  const [showMCPServerTools, setShowMCPServerTools] = useState(false);
  const { mcpServers, mcpServerTools, selectedServer } = useMcpStore();

  const handleShowMCPServers = () => {
    setShowAllMCPServers(!showAllMCPServers);
    setShowMCPServerTools(false);
  };

  const handleShowMCPTools = (server: MCPServer) => {
    useMcpStore.setState({ mcpServerTools: server.tools });
    useMcpStore.setState({ selectedServer: server });
    setShowMCPServerTools(true);
  };

  const handleRefreshMCPServers = () => {
    setRefreshSpinning(true);
    syncServers();
    setTimeout(() => setRefreshSpinning(false), 1000);
  };

  const handleRetry = () => {
    if (!selectedServer) return;
    console.log('************Retrying server***********');
    setRetrying(true);
    mcpServerRestart(selectedServer.name);
    setTimeout(() => setRetrying(false), 1000);
  };

  const handleEnablingOrDisablingOfTool = (action: 'enable' | 'disable') => {
    if (!selectedServer) return;

    const newDisableState = action === 'enable' ? false : true;

    mcpServerEnableOrDisable(action, selectedServer.name);

    const serverIndex = mcpServers.findIndex((server) => server.name === selectedServer.name);

    if (serverIndex !== -1) {
      const updatedServers = [...mcpServers];
      updatedServers[serverIndex] = {
        ...mcpServers[serverIndex],
        disabled: newDisableState,
      };

      useMcpStore.setState({
        mcpServers: updatedServers,
        selectedServer: {
          ...selectedServer,
          disabled: newDisableState,
        },
      });
    }
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
        {/* ALL MCP SERVERS */}
        {showAllMCPServers && !showMCPServerTools && (
          <div className="flex max-h-[150px] cursor-pointer flex-col justify-between overflow-y-auto bg-gray-500/20">
            {mcpServers.map((server, index) => (
              <div key={index} className="flex justify-between">
                <button
                  className="flex w-full items-center gap-2 overflow-hidden px-2 py-1 hover:text-gray-400"
                  onClick={() => handleShowMCPTools(server)}
                >
                  <MCPServerStatus mcpServerStatus={server.status} />
                  <div className="flex items-center gap-1">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {server.name}
                    </span>
                    <span className="text-gray-500">{server.tool_count} Tools</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* SINGLE MCP SERVER WITH ITS TOOLS */}
        {showMCPServerTools && (
          <div>
            <div className="flex justify-between bg-gray-500/20">
              <button className="flex w-full items-center gap-2 overflow-hidden px-2 py-1 hover:text-gray-400">
                <MCPServerStatus mcpServerStatus={selectedServer?.status || ''} />
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {selectedServer?.name}
                  </span>
                  <span className="text-gray-500">{selectedServer?.tool_count} Tools</span>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <div onClick={() => handleRetry()}>
                  <RotateCw
                    className={`h-4 w-4 hover:cursor-pointer ${retrying && 'animate-spin'}`}
                  />
                </div>
                <div className="mr-2 flex items-center space-x-2">
                  <button
                    onClick={() =>
                      handleEnablingOrDisablingOfTool(!selectedServer?.disabled ? 'disable' : 'enable')
                    }
                    className={`relative h-5 w-10 rounded-full transition-colors duration-300 ${!selectedServer?.disabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${!selectedServer?.disabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

              </div>
            </div>
            <div className="h-full max-h-[150px] overflow-y-auto bg-transparent p-2">
              {mcpServerTools.map((tool, index) => (
                <div key={index} className="mb-2 flex flex-col">
                  <div className="text-xs">{tool.name}</div>
                  <p className="text-xs text-gray-500">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="m-1.5 flex items-center justify-between">
          <div className="mr-2 flex w-full items-center gap-2 overflow-hidden">
            {(showAllMCPServers || showMCPServerTools) && (
              <button>
                <ArrowLeft
                  className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5"
                  onClick={() => handleBack()}
                />
              </button>
            )}
            <button
              className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
              onClick={() => handleShowMCPServers()}
              {...(!showAllMCPServers &&
                !showMCPServerTools && {
                'data-tooltip-id': 'mcp-tooltips',
                'data-tooltip-content': 'MCP (1 Available MCP Servers)',
                'data-tooltip-place': 'top-start',
              })}
            >
              <Hammer className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5" />
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {mcpServers.length} Available MCP Servers
              </div>
            </button>
            <div
              {...(!showAllMCPServers &&
                !showMCPServerTools &&
              {
                // "data-tooltip-id": "mcp-tooltips",
                // "data-tooltip-content": MCPCircleHelpTooltipContent,
                // "data-tooltip-place": "top-start"
              })}
            >
              <CircleHelp className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRefreshMCPServers()}
              {...(!showAllMCPServers &&
                !showMCPServerTools && {
                'data-tooltip-id': 'mcp-tooltips',
                'data-tooltip-content': 'Refresh MCP Servers',
                'data-tooltip-place': 'top-start',
              })}
            >
              <RefreshCw
                className={`h-4 w-4 hover:cursor-pointer hover:bg-slate-400 hover:bg-opacity-10 ${refreshSpinning && 'animate-spin'}`}
              />
            </button>
            <button
              onClick={() => openMcpSettings()}
              {...(!showAllMCPServers &&
                !showMCPServerTools && {
                'data-tooltip-id': 'mcp-tooltips',
                'data-tooltip-content': 'Configure MCP Servers',
                'data-tooltip-place': 'top-start',
              })}
            >
              <FilePenLine className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5" />
            </button>
          </div>
        </div>
        <Tooltip id="mcp-tooltips" />
      </div>
    </div>
  );
}
