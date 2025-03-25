export interface UsageTrackingProperties {
  session_id?: number;
  lines: number;
  filepath: string;
  timestamp?: string;
}

export type UsageTrackingRequest = {
  anonymous_id?: String;
  event: "accepted" | "generated" | "copied";
  properties: UsageTrackingProperties;
};
