import { MCPToolProps } from '@/types';
import BaseTool from './BaseTools';
import React from 'react';

const FocusedSnippetSearcher: React.FC<MCPToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  let displayText: string;
  switch (toolRunStatus) {
    case 'pending':
      displayText = 'Searching Codebase...';
      break;
    case 'error':
      displayText = 'Error Searching Codebase';
      break;
    case 'completed':
      displayText = 'Scanned Codebase';
      break;
    case 'aborted':
      displayText = 'Searching Codebase Aborted';
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

export default FocusedSnippetSearcher;
