import { ToolProps } from '@/types';
import ChipBase from './ChipBase';
import React from 'react';

const PublicUrlContentReaderTool: React.FC<ToolProps> = ({
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
    <ChipBase
      toolRunStatus={toolRunStatus}
      toolRequest={toolRequest}
      toolUseId={toolUseId}
      toolResponse={toolResponse}
      displayText={displayText}
    />
  );
};

export default PublicUrlContentReaderTool;
