import { MCPToolProps } from '@/types';
import BaseTool from './baseTools';
import React from 'react';

const PublicUrlContentReaderTool: React.FC<MCPToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  let displayText: string;
  switch (toolRunStatus) {
    case 'pending':
      displayText = 'Analysing URL...';
      break;
    case 'error':
      displayText = 'Error Analysing URL';
      break;
    case 'completed':
      displayText = 'Analyzed URL';
      break;
    case 'aborted':
      displayText = 'Analysing URL Aborted';
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

export default PublicUrlContentReaderTool;
