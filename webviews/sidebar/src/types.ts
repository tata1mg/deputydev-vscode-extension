export type ViewType =
  | 'chat'
  | 'code-review'
  | 'setting'
  | 'loader'
  | 'history'
  | 'auth'
  | 'profile'
  | 'error'
  | 'force-upgrade'
  | 'help'
  | 'faq';
export type ProgressStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'IDLE';
export type ThemeKind = 'dark' | 'light' | 'high-contrast' | 'high-contrast-light' | 'unknown';
export type UserData = {
  email: string;
  userName: string;
};

export interface IndexingStatusData {
  file_path: string;
  status: ProgressStatus;
}

export type IndexingProgressData = {
  task: string;
  status: ProgressStatus;
  repo_path: string;
  progress: number;
  indexing_status: IndexingStatusData[];
};

export type EmbeddingProgressData = {
  task: string;
  status: ProgressStatus;
  repo_path: string;
  progress: number;
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

export type ChatReferenceItemTypes =
  | 'file'
  | 'directory'
  | 'function'
  | 'keyword'
  | 'code_snippet'
  | 'url'
  | 'code_snippet'
  | 'class';

export type ChatReferenceItem = {
  index: number;
  type: ChatReferenceItemTypes;
  keyword: string;
  path: string;
  chunks: Chunk[];
  value?: string;
  noEdit?: boolean;
  url?: string;
};

export type ActiveFileChatReferenceItem = {
  type: ChatReferenceItemTypes;
  activeFileUri: string;
  startLine?: number;
  endLine?: number;
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
  | ChatReplaceBlockMessage
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
  activeFileReference?: ActiveFileChatReferenceItem;
  s3References: S3Object[];
  actor: 'USER';
  lastMessageSentTime?: Date | null;
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
  is_execa_process?: boolean;
  process_id?: number;
  exit_code?: number;
}

export interface ChatToolUseMessage {
  type: 'TOOL_USE_REQUEST' | 'TOOL_USE_REQUEST_BLOCK' | 'TOOL_CHIP_UPSERT';
  content: {
    tool_name: string;
    tool_use_id: string;
    input_params_json: string;
    tool_input_json?: { prompt: string } | string;
    result_json: string;
    status: 'pending' | 'completed' | 'error' | 'aborted';
    write_mode?: boolean;
    terminal?: TerminalProcess;
    diff?: { addedLines: number; removedLines: number };
    toolRequest?: any;
    toolResponse?: any;
  };
}
export interface TerminalProcess {
  terminal_approval_required?: boolean;
  terminal_output?: string;
  process_id?: number;
  exit_code?: number;
  is_execa_process?: boolean;
}

export interface ChatThinkingMessage {
  type: 'THINKING';
  text: string;
  status: ToolRunStatus;
  actor?: 'ASSISTANT';
  content?: any;
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

export interface ChatReplaceBlockMessage {
  type: 'REPLACE_IN_FILE_BLOCK' | 'REPLACE_IN_FILE_BLOCK_STREAMING';
  content: {
    filepath?: string;
    diff: string;
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
  errorData: LLMThrottlingException | LLMinputTokenLimitException;
  content?: any;
}

export interface LLMThrottlingException {
  type: 'THROTTLING_ERROR';
  model_name?: string;
  retry_after?: number;
}
export interface LLMinputTokenLimitException {
  type: 'INPUT_TOKEN_LIMIT_ERROR';
  model_name?: string;
  actor: 'ASSISTANT';
  retry_after?: number;
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
  content?: any;
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
  contextRepositories: WorkspaceRepo[];
  workspaceRepos: WorkspaceRepo[];
  activeRepo: string | null;
  setWorkspaceRepos: (repos: WorkspaceRepo[], activeRepo: string | null) => void;
  setActiveRepo: (repoPath: string) => void;
}

export type UsageTrackingRequestFromSidebar = {
  eventType: string;
  eventData: Record<string, any>;
};

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

export type ToolRunStatus = 'idle' | 'pending' | 'completed' | 'error' | 'aborted';

export interface ToolMeta {
  toolName: string;
  serverName: string;
}

export interface ToolRequest {
  requestData: any;
  toolName: string;
  toolMeta: ToolMeta;
  requiresApproval: boolean;
}

export interface BaseToolProps {
  toolRunStatus: ToolRunStatus;
  toolRequest?: ToolRequest | null;
  toolResponse?: any;
  toolUseId: string;
  displayText: string;
}

export interface MCPToolProps {
  toolRunStatus: ToolRunStatus;
  toolRequest?: ToolRequest | null;
  toolResponse?: any;
  toolUseId: string;
}

export interface MCPServer {
  name: string;
  status: string;
  tool_count: number;
  tools: MCPServerTool[];
  error: string;
  disabled: boolean;
}

export interface MCPServerTool {
  name: string;
  description: string;
}

export interface MCPStorage {
  mcpServers: MCPServer[];
  selectedServer: MCPServer | undefined;
  showAllMCPServers: boolean;
  showMCPServerTools: boolean;
  setMcpServers: (mcpServers: MCPServer[]) => void;
}
export interface S3Object {
  key?: string;
  get_url?: string;
}

export interface ChangedFile {
  fileName: string;
  filePath: string;
  repoPath: string;
  addedLines: number;
  removedLines: number;
  sessionId: number;
  accepted: boolean;
}

export interface ChangedFilesStorage {
  changedFiles: ChangedFile[];
  filesChangedSessionId: number;
}

export interface IndexingDataStorage {
  indexingProgressData: IndexingProgressData[];
  embeddingProgressData: EmbeddingProgressData[];
}

// Code review
export interface LineChanges {
  added: number;
  removed: number;
}

export interface FileWiseChange {
  file_name: string;
  file_path: string;
  line_changes: LineChanges;
  status: string;
  diff: string;
}

export interface NewReview {
  file_wise_changes: FileWiseChange[];
  source_branch: string;
  target_branch: string;
  source_commit: string;
  target_commit: string;
  origin_url: string;
  repo_name: string;
  fail_message: string;
  eligible_for_review: boolean;
}

export interface ReviewOption {
  displayName: 'Review All Changes' | 'Review Uncommitted Changes' | 'Review Committed Changes';
  value: 'ALL' | 'UNCOMMITTED_ONLY' | 'COMMITTED_ONLY';
}

export interface UserAgent {
  id: number;
  agent_name: string;
  user_team_id: number;
  display_name: string;
  custom_prompt: string;
  exclusions: [];
  inclusions: [];
  confidence_score: number;
  objective: string;
  is_custom_agent: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnabledAgent {
  id: number;
  displayName: string;
}

export interface CodeReviewStorage {
  searchedBranches: string[];
  selectedTargetBranch: string;
  new_review: NewReview;
  activeReviewOption: ReviewOption;
  reviewOptions: ReviewOption[];
  pastReviews: Review[];
  userAgents: UserAgent[];
  isFetchingChangedFiles: boolean;
  activeReviewId: number;
  activeReviewSessionId: number;
  showReviewProcess: boolean;
  reviewStatus: 'RUNNING' | 'COMPLETED' | 'STOPPED' | 'IDLE' | 'FAILED';
  repoId: number;
  commentFixQuery: string;
  reviewErrorMessage: string;
  showReviewError: boolean;
  isFetchingPastReviews: boolean;
  expandedReview: number | null;
  isPastReviewsFetchedAfterReviewCompletion: boolean;
}

export interface CodeReviewSetting {
  enabledAgents: EnabledAgent[];
}

export interface CodeReviewComment {
  id: number;
  title: string;
  comment: string;
  comment_status: string;
  rationale: string;
  corrective_code: string;
  file_path: string;
  line_hash: string;
  line_number: number;
  tag: string;
  agent_ids: number[];
}

export interface AgentSummary {
  count: number;
  id: number;
  name: string;
  display_name: string;
}

export interface Review {
  id: number;
  title: string;
  execution_time_seconds: number | null;
  review_datetime: string | null;
  comments: Record<string, CodeReviewComment[]>;
  agent_summary: AgentSummary[];
  tag_summary: Record<string, number>;
  meta: {
    file_count: number;
    comment_count: number;
  };
}

export interface AgentPayload {
  agent_id: number;
  review_id: number;
  type: string;
}

export type AgentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'STOPPED';

export type StepStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'STOPPED';

export type ReviewStep = {
  id: string;
  label: string;
  status: StepStatus;
  agents?: Array<{
    id: number;
    name: string | '';
    status: AgentStatus;
  }>;
};
