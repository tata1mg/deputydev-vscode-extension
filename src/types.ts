export type UsageTrackingRequest = {
  event_id?: string;
  event_type: "accepted" | "generated";
  session_id?: number;
  lines: number;
  file_path: string;
  timestamp?: string;
};
