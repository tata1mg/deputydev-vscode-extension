import { MCPService } from '../services/mcp/mcpService';
import * as vscode from 'vscode';

interface MCPTool {
  name: string; // Unique identifier for the tool
  description?: string; // Human-readable description
  inputSchema: {
    // JSON Schema for the tool's parameters
    type: 'object';
    properties: {
      [key: string]: string | number | boolean | object | null; // Parameter types
    };
  };
  annotations?: {
    // Optional hints about tool behavior
    title?: string; // Human-readable title for the tool
    readOnlyHint?: boolean; // If true, the tool does not modify its environment
    destructiveHint?: boolean; // If true, the tool may perform destructive updates
    idempotentHint?: boolean; // If true, repeated calls with same args have no additional effect
    openWorldHint?: boolean; // If true, tool interacts with external entities
  };
}

interface ServerWiseMCPTool {
  serverId: string; // Unique identifier for the server
  tools: MCPTool[]; // List of tools available for this server
}

export class MCPManager {
  private static instance: MCPManager;
  private readonly mcpService: MCPService;
  private readonly outputChannel: vscode.LogOutputChannel;

  constructor(outputChannel: vscode.LogOutputChannel) {
    this.mcpService = new MCPService();
    this.outputChannel = outputChannel;
  }

  public async getCurrentMCPTools(): Promise<ServerWiseMCPTool[]> {
    const allMcpServers = await this.mcpService.getActiveServerTools();
    if (!allMcpServers.data || allMcpServers.data.length === 0) {
      this.outputChannel.error('No MCP servers found');
      return [];
    }

    // create server wise tools
    const serverWiseTools: ServerWiseMCPTool[] = allMcpServers.data.map((server : any) => ({
      serverId: server.server_name,
      tools: server.tools,
    }));
    this.outputChannel.info('MCP Servers: ', allMcpServers);
    return serverWiseTools;
  }

  public async runMCPTool(
    mcpServerId: string,
    toolName: string,
    toolArgs: {
      [key: string]: string | number | boolean | object | null; // Parameter types
    },
  ): Promise<{
    [key: string]: string | number | boolean | object | null; // Parameter types
  }> {
    const serverTools = (await this.getCurrentMCPTools()).find((server) => server.serverId === mcpServerId);
    if (!serverTools) {
      return Promise.reject(new Error(`No tools found for server ${mcpServerId}`));
    }
    const tool = serverTools.tools.find((t) => t.name === toolName);
    if (!tool) {
      return Promise.reject(new Error(`Tool ${toolName} not found for server ${mcpServerId}`));
    }
    // Run the desired tool for the server
    return await this.mcpService.invokeMcpTool({
      server_name: mcpServerId,
      tool_name: toolName,
      tool_arguments: toolArgs,
    });
  }
}
