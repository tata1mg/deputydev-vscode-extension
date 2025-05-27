import {
  mcpServerEnableOrDisable,
  mcpServerRestart,
  openMcpSettings,
  syncServers,
} from '@/commandApi';
import { useMcpStore } from '@/stores/mcpStore';
import { MCPServer } from '@/types';
import { Hammer, RefreshCw, FilePenLine, ArrowLeft, CircleHelp, RotateCw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';
import { useClickAway } from 'react-use';

const MCPCircleHelpTooltipContent =
  'MCP grants DeputyDev to custom tools, click Configure icon to get started with setup.';

const MCPServerStatus: React.FC<{ mcpServerStatus: string }> = ({ mcpServerStatus }) => {
  switch (mcpServerStatus) {
    case 'connecting':
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
  const [retryingServers, setRetryingServers] = useState<Record<string, boolean>>({});
  const { mcpServers, mcpServerTools, selectedServer, showAllMCPServers, showMCPServerTools } =
    useMcpStore();

  const featuresBarRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   syncServers();
  // }, []);

  useClickAway(featuresBarRef, () => {
    useMcpStore.setState({ showAllMCPServers: false });
    useMcpStore.setState({ showMCPServerTools: false });
  });

  const handleShowMCPServers = () => {
    useMcpStore.setState({ showAllMCPServers: !showAllMCPServers });
    useMcpStore.setState({ showMCPServerTools: false });
  };

  const handleShowMCPTools = (server: MCPServer) => {
    useMcpStore.setState({ mcpServerTools: server.tools });
    useMcpStore.setState({ selectedServer: server });
    useMcpStore.setState({ showMCPServerTools: true });
  };

  const handleRefreshMCPServers = () => {
    setRefreshSpinning(true);
    syncServers();
    setTimeout(() => setRefreshSpinning(false), 1000);
  };

  const handleRetry = (serverName: string) => {
    if (!serverName) return;
    console.log('************Retrying server***********');
    setRetryingServers((prev) => ({ ...prev, [serverName]: true }));
    mcpServerRestart(serverName);
    setTimeout(() => {
      setRetryingServers((prev) => ({ ...prev, [serverName]: false }));
    }, 1000);
  };

  const handleEnablingOrDisablingOfTool = (action: 'enable' | 'disable', serverName: string) => {
    if (!serverName) return;

    const newDisableState = action === 'enable' ? false : true;

    mcpServerEnableOrDisable(action, serverName);

    const serverIndex = mcpServers.findIndex((server) => server.name === serverName);

    if (serverIndex !== -1) {
      const updatedServers = [...mcpServers];
      updatedServers[serverIndex] = {
        ...mcpServers[serverIndex],
        disabled: newDisableState,
      };

      useMcpStore.setState({
        mcpServers: updatedServers,
      });

      if (selectedServer) {
        useMcpStore.setState({
          selectedServer: {
            ...selectedServer,
            disabled: newDisableState,
          },
        });
      }
    }
  };

  const handleBack = () => {
    if (showMCPServerTools) {
      useMcpStore.setState({ showMCPServerTools: false });
      return;
    }

    if (showAllMCPServers) {
      useMcpStore.setState({ showAllMCPServers: false });
      return;
    }
  };

  return (
    <div className="flex justify-center pl-3 pr-3">
      <div
        ref={featuresBarRef}
        className="flex w-full flex-col rounded-t-md border-l-2 border-r-2 border-t-2 border-gray-700"
      >
        {/* ALL MCP SERVERS */}
        {showAllMCPServers && !showMCPServerTools && (
          <div
            className="flex max-h-[150px] cursor-pointer flex-col justify-between overflow-y-auto"
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
            }}
          >
            {mcpServers.map((server, index) => (
              <div key={index} className="flex justify-between">
                <button
                  className="flex w-full items-center gap-2 overflow-hidden px-2 py-1 hover:text-gray-400"
                  onClick={() => handleShowMCPTools(server)}
                >
                  <MCPServerStatus mcpServerStatus={server.status} />
                  <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                    <span className="max-w-[50%] overflow-hidden text-ellipsis whitespace-nowrap">
                      {server.name}
                    </span>
                    <span className="text-gray-500">{server.tool_count} Tools</span>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {!server.disabled &&
                    <div
                      onClick={() => handleRetry(server.name)}
                      data-tooltip-id="mcp-tooltips"
                      data-tooltip-content="Restart Server"
                      data-tooltip-place="top-start"
                    >
                      <RotateCw
                        className={`h-4 w-4 hover:cursor-pointer ${retryingServers[server.name] && 'animate-spin'}`}
                      />
                    </div>
                  }
                  <div
                    className="mr-2 flex items-center space-x-2"
                    data-tooltip-id="mcp-tooltips"
                    data-tooltip-content="Enable/Disable Server"
                    data-tooltip-place="top-start"
                  >
                    <button
                      onClick={() =>
                        handleEnablingOrDisablingOfTool(
                          !server.disabled ? 'disable' : 'enable',
                          server.name
                        )
                      }
                      className={`relative h-4 w-8 rounded-full transition-colors duration-300 ${!server.disabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                    >
                      <div
                        className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300 ${!server.disabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SINGLE MCP SERVER WITH ITS TOOLS */}
        {showMCPServerTools && (
          <div>
            <div
              className="flex justify-between"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
              }}
            >
              <button className="flex w-full items-center gap-2 overflow-hidden px-2 py-1 hover:text-gray-400">
                <MCPServerStatus mcpServerStatus={selectedServer?.status || ''} />
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                  <span className="max-w-[50%] overflow-hidden text-ellipsis whitespace-nowrap">
                    {selectedServer?.name}
                  </span>
                  <span className="text-gray-500">{selectedServer?.tool_count} Tools</span>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {!selectedServer?.disabled &&
                  <div
                    onClick={() => handleRetry(selectedServer?.name || '')}
                    data-tooltip-id="mcp-tooltips"
                    data-tooltip-content="Restart Server"
                    data-tooltip-place="top-start"
                  >
                    <RotateCw
                      className={`h-4 w-4 hover:cursor-pointer ${retryingServers[selectedServer?.name || ''] && 'animate-spin'}`}
                    />
                  </div>
                }
                <div
                  className="mr-2 flex items-center space-x-2"
                  data-tooltip-id="mcp-tooltips"
                  data-tooltip-content="Enable/Disable Server"
                  data-tooltip-place="top-start"
                >
                  <button
                    onClick={() =>
                      handleEnablingOrDisablingOfTool(
                        !selectedServer?.disabled ? 'disable' : 'enable',
                        selectedServer?.name || ''
                      )
                    }
                    className={`relative h-4 w-8 rounded-full transition-colors duration-300 ${!selectedServer?.disabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                  >
                    <div
                      className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300 ${!selectedServer?.disabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>
            <div
              className="h-full max-h-[150px] overflow-y-auto p-2 text-xs"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
              }}
            >
              {mcpServerTools && !selectedServer?.error && (
                <>
                  {mcpServerTools.map((tool, index) => (
                    <div key={index} className="mb-2 flex flex-col">
                      <div>{tool.name}</div>
                      <p className="text-gray-500">{tool.description}</p>
                    </div>
                  ))}
                </>
              )}
              {selectedServer?.error && (
                <div className="text-center text-red-600">{selectedServer.error}</div>
              )}
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
            <div className="flex max-w-[85%] gap-2">
              <button
                className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
                onClick={() => handleShowMCPServers()}
                data-tooltip-id="mcp-tooltips"
                data-tooltip-content={`MCP (${mcpServers.length} Available MCP Servers)`}
                data-tooltip-place="top-start"
              >
                <div>
                  <Hammer className="h-4 w-4 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5" />
                </div>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                  {mcpServers.length} Available MCP Servers
                </div>
              </button>
              <div
                data-tooltip-id="mcp-tooltips"
                data-tooltip-content={MCPCircleHelpTooltipContent}
                data-tooltip-place="top-start"
                data-tooltip-class-name="max-w-[80%]"
              >
                <CircleHelp className="h-4 w-4 opacity-50 hover:cursor-pointer hover:bg-slate-700 hover:bg-opacity-5" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRefreshMCPServers()}
              data-tooltip-id="mcp-tooltips"
              data-tooltip-content="Refresh MCP Servers"
              data-tooltip-place="top-start"
            >
              <RefreshCw
                className={`h-4 w-4 hover:cursor-pointer hover:bg-slate-400 hover:bg-opacity-10 ${refreshSpinning && 'animate-spin'}`}
              />
            </button>
            <button
              onClick={() => openMcpSettings()}
              data-tooltip-id="mcp-tooltips"
              data-tooltip-content="Configure MCP Servers"
              data-tooltip-place="top-start"
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
