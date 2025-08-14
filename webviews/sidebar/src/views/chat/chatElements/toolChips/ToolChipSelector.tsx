import { MCPToolProps } from '@/types';
import React from 'react';
import FilePathSearcherTool from './FilePathSearcherChip';
import GrepSearchTool from './GrepSearchChip';
import WebSearchTool from './WebSearchChip';
import PublicUrlContentReaderTool from './PublicUrlContentReaderChip';
import { IterativeFileReader } from './IterativeFileReaderChip';
import MCPTool from './MCPChip';
import AskUserInput from './AskUserInputChip';
import { CreateNewWorkspace } from './CreateNewWorkspaceChip';
import RelatedCodeSearcher from './RelatedCodeSearcherChip';
import FocusedSnippetSearcher from './FocusedSnippetSearcherChip';

const ToolChipSelector: React.FC<MCPToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
}) => {
  if (toolRequest?.toolName === 'ask_user_input') {
    return <AskUserInput input={toolRequest?.requestData} />;
  } else if (toolRequest?.toolName === 'create_new_workspace') {
    return <CreateNewWorkspace tool_id={toolUseId} status={toolRunStatus || 'pending'} />;
  } else if (toolRequest?.toolName === 'focused_snippets_searcher') {
    return (
      <FocusedSnippetSearcher
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  } else if (toolRequest?.toolName === 'related_code_searcher') {
    return (
      <RelatedCodeSearcher
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  } else if (toolRequest?.toolName === 'file_path_searcher') {
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
  } else if (toolRequest?.toolName === 'iterative_file_reader') {
    return (
      <IterativeFileReader
        status={toolRunStatus}
        tool_name={toolRequest.toolName}
        toolInputJson={toolRequest.requestData}
      />
    );
  } else {
    return (
      <MCPTool
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  }
};

export default ToolChipSelector;
