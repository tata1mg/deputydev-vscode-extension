export type ViewType =
  | "chat"
  | "setting"
  | "setting2"
  | "loader"
  | "history"
  | "auth"
  | "profile"
  | "error"
  | "force-upgrade";
export type ProgressStatus = "Completed" | "Failed" | "In Progress";
export type ThemeKind =  'dark' | 'light' | 'high-contrast' | 'high-contrast-light' | 'unknown';
export type UserData = {
  email: string;
  userName: string;
};

export type ProgressBarData = {
  repo: string;
  progress: number;
  status: ProgressStatus;
};

export type ProfileUiDiv = {
  label: string;
  type: string;
  icon: string;
  url?: string;
  data?: string;
};

export type AutocompleteOption = {
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
  type: "file" | "directory" | "function" | "keyword" | string;
  keyword: string;
  path: string;
  chunks: Chunk[];
  value?: string;
  noEdit?: boolean;
};

export type ChatType = "ask" | "write";

export type ChatChunkMessage = {
  chunk: string;
  error: string;
};

export type ChatMessage =
  | ChatUserMessage
  | ChatAssistantMessage
  | ChatToolUseMessage
  | ChatThinkingMessage
  | ChatCodeBlockMessage
  | ChatErrorMessage
  | ChatCompleteMessage;

export type ChatUserMessage = {
  type: "TEXT_BLOCK";
  content: {
    text: string;
    focus_items?: ChatReferenceItem[];
  };
  referenceList: ChatReferenceItem[];
  actor: "USER";
};

export interface ChatAssistantMessage {
  type: "TEXT_BLOCK";
  content: {
    text: string;
  };
  usage?: string;
  actor: "ASSISTANT";
}



export interface TerminalPanelProps {
  content: string;
  terminal_output?: string;
  status?: string;
  terminal_approval_required?: boolean;
}

export interface ChatToolUseMessage {
  type: "TOOL_USE_REQUEST" | "TOOL_USE_REQUEST_BLOCK";
  content: {
    tool_name: string;
    tool_use_id: string;
    input_params_json: { prompt: string } | string;
    tool_input_json?: { prompt: string };
    result_json: string;
    status: "pending" | "completed" | "error";
    write_mode?: boolean;
    terminal_approval_required?: boolean;
  };
}

export interface ChatThinkingMessage {
  type: "THINKING";
  text: string;
  completed: boolean;
  actor?: "ASSISTANT";
}

export interface ChatCodeBlockMessage {
  type: "CODE_BLOCK" | "CODE_BLOCK_STREAMING";
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
  actor: "ASSISTANT";
  write_mode: boolean;
  status: "pending" | "completed" | "error";
}

export interface ChatErrorMessage {
  type: "ERROR";
  retry: boolean;
  payload_to_retry: unknown;
  error_msg: string;
  actor: "ASSISTANT";
}

export interface ChatCompleteMessage {
  type: "QUERY_COMPLETE";
  actor: "ASSISTANT";
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
  setWorkspaceRepos: (
    repos: WorkspaceRepo[],
    activeRepo: string | null,
  ) => void;
  setActiveRepo: (repoPath: string) => void;
}

export interface UsageTrackingProperties {
  session_id?: number;
  lines: number;
  file_path: string;
  timestamp?: string;
  source?: "inline-modify" | "inline-chat" | "chat" | "act" | "inline-chat-act";
}

export type UsageTrackingRequest = {
  anonymous_id?: String;
  event: "accepted" | "generated" | "copied" | "applied";
  properties: UsageTrackingProperties;
};
