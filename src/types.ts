export interface UsageTrackingProperties {
  session_id?: number;
  lines: number;
  file_path: string;
  timestamp?: string;
  source?: string;
}

export type UsageTrackingRequest = {
  anonymous_id?: string;
  event: string;
  properties: UsageTrackingProperties;
};

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
  type: 'file' | 'directory' | 'function' | 'keyword' | string;
  keyword: string;
  path: string;
  chunks: Chunk[];
  value?: string;
  url?: string;
};

export interface ChatPayload {
  search_web: boolean;
  llm_model: string;
  focus_files?: string[];
  focus_chunks?: string[];
  message_id?: string;
  query?: string;
  is_tool_response?: boolean;
  write_mode?: boolean;
  referenceList?: ChatReferenceItem[];
  tool_use_response?: {
    tool_name: string;
    tool_use_id?: string;
    response: any;
  };
  previous_query_ids?: number[];
  focus_items?: Array<any>;
  deputy_dev_rules?: string;
  is_inline?: boolean;
  vscode_env?: string;
  os_name: string;
  shell: string;
  is_from_runTool_response?: string;
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
  default_mode: 'ask' | 'write';
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
