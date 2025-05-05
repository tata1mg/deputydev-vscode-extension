export interface UsageTrackingProperties {
  session_id?: number;
  lines: number;
  file_path: string;
  timestamp?: string;
  source?: 'inline-modify' | 'inline-chat' | 'chat' | 'act' | 'inline-chat-act';
}

export type UsageTrackingRequest = {
  anonymous_id?: string;
  event: 'accepted' | 'generated' | 'copied' | 'applied';
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
  isWebSearchEnabled: boolean;
  llmModel: string;
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
  os_name: string;
  shell: string;
}

export interface SearchTerm {
  keyword: string;
  type: string;
}

export interface ToolRequest {
  tool_name: string;
  tool_use_id: string;
  accumulatedContent: string;
  write_mode?: boolean;
  llmModel: string;
  isWebSearchEnabled: boolean;
}

export interface CurrentDiffRequest {
  filepath: string;
  raw_diff: string;
}

export interface SaveUrlRequest {
  id?: string;
  name: string;
  url: string;
}
