import { ToolProps } from '@/types';
import React from 'react';
import FilePathSearcherTool from './FilePathSearcherChip';
import GrepSearchTool from './GrepSearchChip';
import WebSearchTool from './WebSearchChip';
import PublicUrlContentReaderTool from './PublicUrlContentReaderChip';
import MCPTool from './MCPChip';
import AskUserInput from './AskUserInputChip';
import { CreateNewWorkspace } from './CreateNewWorkspaceChip';
import RelatedCodeSearcher from './RelatedCodeSearcherChip';
import FocusedSnippetSearcher from './FocusedSnippetSearcherChip';
import { TerminalPanel } from './TerminalPanel';
import FileEditedChip from './FileEditedChip';
import IterativeFileReader from './IterativeFileReaderChip';
import TerminalPanelHistory from './TerminalPanelHistory';

const ToolChipSelector: React.FC<ToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
  terminal,
  isHistory,
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
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
      />
    );
  } else if (toolRequest?.toolName === 'execute_command') {
    if (isHistory) {
      return (
        <TerminalPanelHistory
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );
    }
    return (
      <TerminalPanel
        tool_id={toolUseId}
        terminal_command={(toolRequest?.requestData as string) || ''}
        status={toolRunStatus}
        show_approval_options={terminal?.terminal_approval_required}
        is_execa_process={terminal?.is_execa_process || false}
        process_id={terminal?.process_id}
        terminal_output={terminal?.terminal_output || ''}
        exit_code={terminal?.exit_code}
      />
    );
  } else if (
    toolRequest?.toolName === 'replace_in_file' ||
    toolRequest?.toolName === 'write_to_file'
  ) {
    return (
      <FileEditedChip
        toolRequest={toolRequest}
        toolResponse={toolResponse}
        toolUseId={toolUseId}
        toolRunStatus={toolRunStatus}
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
