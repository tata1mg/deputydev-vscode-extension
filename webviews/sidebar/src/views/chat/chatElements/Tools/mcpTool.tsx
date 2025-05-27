import { BaseToolProps, ToolRequest } from '@/types';
import BaseTool from './baseTools';
import React from 'react';

const MCPTool: React.FC<BaseToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  return (
    <BaseTool
      toolRunStatus={toolRunStatus}
      toolRequest={toolRequest}
      toolUseId={toolUseId}
      toolResponse={toolResponse}
    />
  );
};

export default MCPTool;
