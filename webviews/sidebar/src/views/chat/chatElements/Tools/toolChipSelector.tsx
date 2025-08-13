import { MCPToolProps } from '@/types';
import React from 'react';
import FilePathSearcherTool from './FilePathSearcherTool';
import GrepSearchTool from './GrepSearchTool';
import { t } from 'framer-motion/dist/types.d-D0HXPxHm';
import WebSearchTool from './WebSearchTool';
import PublicUrlContentReaderTool from './PublicUrlContentReader';

const ToolChipSelector: React.FC<MCPToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  if (toolRequest?.toolName === 'file_path_searcher') {
    return (
      <FilePathSearcherTool
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  } else if (toolRequest?.toolName === 'grep_search') {
    return (
      <GrepSearchTool
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  } else if (toolRequest?.toolName === 'web_search') {
    return (
      <WebSearchTool
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  } else if (toolRequest?.toolName === 'public_url_content_reader') {
    return (
      <PublicUrlContentReaderTool
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  }
};

export default ToolChipSelector;
