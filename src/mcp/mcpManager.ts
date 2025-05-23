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

class MCPManager {
  private static instance: MCPManager;

  constructor() {}

  public static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  public getCurrentMCPTools(): ServerWiseMCPTool[] {
    return this.mcp.getTools();
  }

  public runMCPTool(
    mcpServerId: string,
    toolName: string,
    toolArgs: {
      [key: string]: string | number | boolean | object | null; // Parameter types
    },
  ): Promise<{
    [key: string]: string | number | boolean | object | null; // Parameter types
  }> {
    const serverTools = this.getCurrentMCPTools().find((server) => server.serverId === mcpServerId);
    if (!serverTools) {
      return Promise.reject(new Error(`No tools found for server ${mcpServerId}`));
    }
    const tool = serverTools.tools.find((t) => t.name === toolName);
    if (!tool) {
      return Promise.reject(new Error(`Tool ${toolName} not found for server ${mcpServerId}`));
    }
    // Run the desired tool for the server
    return this.runTool(tool, toolArgs);
  }
}
