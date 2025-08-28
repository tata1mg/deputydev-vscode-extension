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
import TerminalPanelHistory from './TerminalPanelHistory';
import GetUsageTool from './GetUsageChip';
import ResolveImportTool from './ResolveImportChip';
import IterativeFileReaderChip from './IterativeFileReaderChip';

const ToolChipSelector: React.FC<ToolProps> = ({
  toolRequest,
  toolResponse,
  toolUseId,
  toolRunStatus,
  terminal,
  isHistory,
}) => {
  switch (toolRequest?.toolName) {
    case 'ask_user_input':
      return <AskUserInput input={toolRequest?.requestData} />;

    case 'create_new_workspace':
      return <CreateNewWorkspace tool_id={toolUseId} status={toolRunStatus || 'pending'} />;

    case 'focused_snippets_searcher':
      return (
        <FocusedSnippetSearcher
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'related_code_searcher':
      return (
        <RelatedCodeSearcher
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'get_usage_tool':
      return (
        <GetUsageTool
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'resolve_import_tool':
      return (
        <ResolveImportTool
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'file_path_searcher':
      return (
        <FilePathSearcherTool
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'grep_search':
      return (
        <GrepSearchTool
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'web_search':
      return (
        <WebSearchTool
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'public_url_content_reader':
      return (
        <PublicUrlContentReaderTool
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'iterative_file_reader':
      return (
        <IterativeFileReaderChip
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    case 'execute_command':
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

    case 'replace_in_file':
    case 'write_to_file':
      return (
        <FileEditedChip
          toolRequest={toolRequest}
          toolResponse={toolResponse}
          toolUseId={toolUseId}
          toolRunStatus={toolRunStatus}
        />
      );

    default:
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
