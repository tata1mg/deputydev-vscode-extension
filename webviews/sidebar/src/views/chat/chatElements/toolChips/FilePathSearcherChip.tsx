import { ToolProps } from '@/types';
import ChipBase from './ChipBase';
import React from 'react';

const FilePathSearcherTool: React.FC<ToolProps> = ({
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
    <ChipBase
      toolRunStatus={toolRunStatus}
      toolRequest={toolRequest}
      toolUseId={toolUseId}
      toolResponse={toolResponse}
      displayText={displayText}
    />
  );
};

export default FilePathSearcherTool;
