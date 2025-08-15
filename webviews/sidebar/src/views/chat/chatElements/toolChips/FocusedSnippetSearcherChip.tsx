import { ToolProps } from '@/types';
import ChipBase from './ChipBase';
import React from 'react';

const FocusedSnippetSearcher: React.FC<ToolProps> = ({
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
    <ChipBase
      toolRunStatus={toolRunStatus}
      toolRequest={toolRequest}
      toolUseId={toolUseId}
      toolResponse={toolResponse}
      displayText={displayText}
    />
  );
};

export default FocusedSnippetSearcher;
