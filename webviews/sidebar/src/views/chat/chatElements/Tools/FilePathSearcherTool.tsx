import { MCPToolProps } from '@/types';
import BaseTool from './baseTools';
import React from 'react';

const FilePathSearcherTool: React.FC<MCPToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  let displayText: string;
  switch (toolRunStatus) {
    case 'pending':
      displayText = 'Scanning File Paths...';
      break;
    case 'error':
      displayText = 'Error Scanning File Paths';
      break;
    case 'completed':
      displayText = 'Scanned File Paths';
      break;
    case 'aborted':
      displayText = 'Scanning File Paths Aborted';
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

export default FilePathSearcherTool;
