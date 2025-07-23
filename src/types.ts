export enum AuthStatus {
  AUTHENTICATED = 'AUTHENTICATED',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
}

export type UsageTrackingRequest = {
  eventType: string;
  eventData: Record<string, any>;
  sessionId: number;
};

export interface ErrorTrackingRequestForBackend {
  error_id: string;
  error_type: string;
  client_version: string;
  repo_name?: string;
  error_source: string;
  timestamp: string;
  session_id?: number;
  user_email?: string;
  error_data: Record<string, any>;
  user_system_info?: Record<string, any>;
  stack_trace?: string;
}

export type ChunkCallback = (data: { name: string; data: unknown }) => void;

export type Chunk = {
  start_line: number;
  end_line: number;
  chunk_hash: string;
  file_hash: string;
  file_path: string;
  meta_info?: any;
};

type ChatReferenceItem = {
  index: number;
  type: 'file' | 'directory' | 'function' | 'keyword' | 'url' | 'code_snippet' | 'class';
  keyword: string;
  path: string;
  chunks: Chunk[];
  value?: string;
  url?: string;
};

export interface MCPToolMetadata {
  tool_name: string; // Unique identifier for the tool
  server_id: string; // Name of the server where the tool is available
  type: 'MCP';
}

export interface ClientTool {
  name: string; // Unique identifier for the tool
  description: string; // Human-readable description
  input_schema: {
    // JSON Schema for the tool's parameters
    type: 'object';
    properties: {
      [key: string]: string | number | boolean | object | null;
    };
  };
  tool_metadata: MCPToolMetadata;
  auto_approve: boolean; // Whether the tool can be used without explicit approval
}

export interface ChatPayload {
  search_web: boolean;
  llm_model: string;
  focus_files?: string[];
  focus_chunks?: string[];
  message_id?: string;
  query?: string;
  is_tool_response?: boolean;
  tool_use_failed?: boolean;
  write_mode?: boolean;
  referenceList?: ChatReferenceItem[];
  batch_tool_responses?: Array<{
    tool_name: string;
    tool_use_id: string;
    response: any;
  }>;
  previous_query_ids?: number[];
  focus_items?: Array<any>;
  directory_items?: Array<any>;
  deputy_dev_rules?: string;
  is_inline?: boolean;
  vscode_env?: string;
  os_name: string;
  shell: string;
  is_from_runTool_response?: string;
  client_tools: Array<ClientTool>;
  active_file_reference?: {
    active_file: string;
    start_line?: number;
    end_line?: number;
  };
}

export interface SearchTerm {
  keyword: string;
  type: string;
}

export interface ToolRequest {
  tool_name: string;
  tool_use_id: string;
  accumulatedContent: string;
  write_mode: boolean;
  is_inline: boolean;
  llm_model: string;
  search_web: boolean;
}

export interface CurrentDiffRequest {
  filepath: string;
  raw_diff: string;
}

export interface CurrentDiffRequest {
  filepath: string;
  raw_diff: string;
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

export type ToolUseResult = {
  name: string;
  data: {
    tool_name: string;
    tool_use_id: string;
    result_json: any;
    status: 'completed' | 'pending' | 'error' | 'aborted';
  };
};

export interface MCPServerToolInvokePayload {
  server_name: string;
  tool_name: string;
  tool_arguments: Record<string, any>;
}

export interface MCPServerToolApprovePayload {
  tool_name: string;
  server_name: string;
}

export type ProgressStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'IDLE';

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

export interface FileSummaryResponse {
  file_path: string;
  file_type: string; // "code", "text", etc.
  strategy_used: string; // "code", "text", etc.
  summary_content: string;
}

export interface ThrottlingErrorData {
  type: 'STREAM_ERROR';
  status: 'LLM_THROTTLED';
  provider: string;
  model: string;
  retry_after?: number | null;
  message: string;
  detail?: string | null;
}

export interface FileReadOrSummaryResponse {
  type: 'full' | 'summary';
  content: string;
  total_lines: number;
}
