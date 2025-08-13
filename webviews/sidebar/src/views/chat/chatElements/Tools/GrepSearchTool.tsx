import { MCPToolProps } from '@/types';
import BaseTool from './baseTools';
import React from 'react';

const GrepSearchTool: React.FC<MCPToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  let displayText: string;
  switch (toolRunStatus) {
    case 'pending':
      displayText = 'Running Grep Search...';
      break;
    case 'error':
      displayText = 'Error Running Grep Search';
      break;
    case 'completed':
      displayText = 'Grep Search Completed.';
      break;
    case 'aborted':
      displayText = 'Grep Search Aborted.';
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

export default GrepSearchTool;
