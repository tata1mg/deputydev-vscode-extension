import { ToolRequest } from "@/types";
import BaseTool from "./baseTools";
import React from "react";

interface MCPToolProps {
    toolRequest?: ToolRequest;
    toolResponse?: Record<string, any>;
}

const MCPTool: React.FC<MCPToolProps> = ({
    toolRequest,
    toolResponse
}) => {
    toolRequest = {
        toolName: "MCP Server",
        toolMeta: {
            "serverName": "Github",
            "serverToolName": "Create Repo"
        },
        requestData: {
            "request": "abc",
        }
    }

    return (
        <BaseTool
            toolDisplayName={`Called ${toolRequest.toolName}`}
            toolRunStatus="completed"
            toolRequest={toolRequest}
        />
    );
}

export default MCPTool;