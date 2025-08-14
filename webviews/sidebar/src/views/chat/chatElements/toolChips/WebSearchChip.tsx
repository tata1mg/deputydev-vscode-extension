import { MCPToolProps } from '@/types';
import BaseTool from './BaseTools';
import React from 'react';

const WebSearchTool: React.FC<MCPToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  let displayText: string;
  switch (toolRunStatus) {
    case 'pending':
      displayText = 'Searching Web...';
      break;
    case 'error':
      displayText = 'Error Searching Web';
      break;
    case 'completed':
      displayText = 'Searched Web';
      break;
    case 'aborted':
      displayText = 'Searching Web Aborted';
      break;
    default:
      displayText = '';
      break;
  }

  return (
    <BaseTool
      toolRunStatus={toolRunStatus}
      toolRequest={toolRequest}
      toolUseId={toolUseId}
      toolResponse={toolResponse}
      displayText={displayText}
    />
  );
};

export default WebSearchTool;
