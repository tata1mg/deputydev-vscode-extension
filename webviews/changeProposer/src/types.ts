export type ViewType =
  | 'chat'
  | 'code-review'
  | 'setting'
  | 'loader'
  | 'history'
  | 'auth'
  | 'profile'
  | 'error'
  | 'force-upgrade';
export type ProgressStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
export type ThemeKind = 'dark' | 'light' | 'high-contrast' | 'high-contrast-light' | 'unknown';
export type UserData = {
  email: string;
  userName: string;
};

export type ProfileUiDiv = {
  label: string;
  type: string;
  icon: string;
  url?: string;
  data?: string;
};

export type AutocompleteOption = {
  id?: string;
  url?: string;
  icon: string;
  label: string;
  value: string;
  description: string;
  chunks: Chunk[];
};

export type FileParts = {
  start_line: number;
  end_line: number;
};

export type SearchResponseItem = {
  type: string;
  value: string;
  path: string;
  chunks: FileParts[];
};

export type Chunk = {
  start_line: number;
  end_line: number;
  chunk_hash: string;
  file_hash: string;
  file_path: string;
  meta_info?: any;
};

export type ChatReferenceItem = {
  index: number;
  type: 'file' | 'directory' | 'function' | 'keyword' | string;
  keyword: string;
  path: string;
  chunks: Chunk[];
  value?: string;
  url?: string;
};

export type ChatType = 'ask' | 'write';

export type ChatChunkMessage = {
  chunk: string;
  error: string;
};

export type ChatMessage =
  | ChatMetaData
  | ChatUserMessage
  | ChatAssistantMessage
  | ChatToolUseMessage
  | ChatThinkingMessage
  | ChatCodeBlockMessage
  | ChatErrorMessage
  | ChatCompleteMessage
  | ChatTerminalNoShell;

export type ChatMetaData = {
  type: 'RESPONSE_METADATA';
  content: {
    session_id: number;
    query_id: number;
  };
};

export type ChatUserMessage = {
  type: 'TEXT_BLOCK';
  content: {
    text: string;
    focus_items?: ChatReferenceItem[];
  };
  referenceList: ChatReferenceItem[];
  actor: 'USER';
};

export interface ChatAssistantMessage {
  type: 'TEXT_BLOCK';
  content: {
    text: string;
  };
  usage?: string;
  actor: 'ASSISTANT';
}

export interface TerminalPanelProps {
  tool_id: string;
  terminal_command: string;
  terminal_output?: string;
  status?: 'pending' | 'completed' | 'error' | 'aborted';
  show_approval_options?: boolean;
}

export interface ChatToolUseMessage {
  type: 'TOOL_USE_REQUEST' | 'TOOL_USE_REQUEST_BLOCK';
  content: {
    tool_name: string;
    tool_use_id: string;
    input_params_json: { prompt: string } | string;
    tool_input_json?: { prompt: string };
    result_json: string;
    status: 'pending' | 'completed' | 'error' | 'aborted';
    write_mode?: boolean;
    terminal_approval_required?: boolean;
  };
}

export interface ChatThinkingMessage {
  type: 'THINKING';
  text: string;
  completed: boolean;
  actor?: 'ASSISTANT';
}

export interface ChatCodeBlockMessage {
  type: 'CODE_BLOCK' | 'CODE_BLOCK_STREAMING';
  content: {
    language: string;
    file_path?: string;
    code: string;
    is_diff?: boolean;
    diff?: string | null;
    added_lines?: number | null;
    removed_lines?: number | null;
    is_live_chat?: boolean;
  };
  completed: boolean;
  actor: 'ASSISTANT';
  write_mode: boolean;
  status: 'pending' | 'completed' | 'error' | 'aborted';
}

export interface ChatErrorMessage {
  type: 'ERROR';
  retry: boolean;
  payload_to_retry: unknown;
  error_msg: string;
  actor: 'ASSISTANT';
}

export interface ChatCompleteMessage {
  type: 'QUERY_COMPLETE';
  actor: 'ASSISTANT';
  content: {
    elapsedTime: number;
    feedbackState: string;
  };
}

export interface ChatTerminalNoShell {
  type: 'TERMINAL_NO_SHELL_INTEGRATION';
  actor: 'ASSISTANT';
}

export interface ChatSessionHistory {
  id: string;
  title: string;
  time: number;
  data: ChatMessage[];
}

export interface Session {
  id: number;
  summary: string;
  age: string;
  updated_at: string;
}

export interface SessionChatContent {
  text: string;
  language: string;
  code: string;
  filePath: string;
  toolName: string;
  toolUseId: string;
  inputParamsJson: JSON;
  resultJson: JSON;
  user: string; // TODO: need to change this
}

export interface sessionChats {
  type: string;
  actor: string;
  content: SessionChatContent;
}

export type ChatAutocompleteOptions = AutocompleteOption[];

export type WorkspaceRepo = {
  repoPath: string;
  repoName: string;
};

export interface WorkspaceStore {
  workspaceRepos: WorkspaceRepo[];
  activeRepo: string | null;
  setWorkspaceRepos: (repos: WorkspaceRepo[], activeRepo: string | null) => void;
  setActiveRepo: (repoPath: string) => void;
}

export interface SaveUrlRequest {
  id?: string;
  name: string;
  url: string;
  isSettings?: boolean;
}

export interface Settings {
  terminal_settings: {
    enable_yolo_mode: boolean;
    command_deny_list: string[];
  };
}

export interface URLListItem {
  id: string;
  name: string;
  url: string;
  last_indexed: string;
}

export interface LLMModels {
  id: number;
  display_name: string;
  name: string;
}
