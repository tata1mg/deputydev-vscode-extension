import { ToolProps } from '@/types';
import ChipBase from './ChipBase';
import React from 'react';

const MCPTool: React.FC<ToolProps> = ({ toolRequest, toolResponse, toolUseId, toolRunStatus }) => {
  let displayText: string;
  switch (toolRunStatus) {
    case 'pending':
      displayText = 'Calling MCP Server';
      break;
    case 'error':
      displayText = 'MCP Server Failed';
      break;
    default:
      displayText = 'Called MCP Server';
      break;
  }

  return (
    <ChipBase
      toolRunStatus={toolRunStatus}
      toolRequest={toolRequest}
      toolUseId={toolUseId}
      toolResponse={toolResponse}
      displayText={displayText}
    />
  );
};

export default MCPTool;
