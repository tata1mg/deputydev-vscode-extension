import { UsageTrackingService } from "../services/usageTracking/UsageTrackingService";
import * as vscode from "vscode";
import { UsageTrackingRequest } from "../types";
import { v4 as uuidv4 } from "uuid";
import { getSessionId } from "../utilities/contextManager";

export class UsageTrackingManager {
  onStarted: () => void = () => {};
  onError: (error: Error) => void = () => {};
  private usageTrackingService = new UsageTrackingService();

  constructor(
    private context?: vscode.ExtensionContext,
    private outputChannel?: vscode.LogOutputChannel
  ) {}

  async start() {
    this.outputChannel?.info("Starting deputydev usage tracking service...");
  }

  restart() {
    this.outputChannel?.info("Restarting deputydev usage tracking service...");
  }

  stop() {
    this.outputChannel?.info("Stopping deputydev usage tracking service...");
  }
  async trackUsage(payload: UsageTrackingRequest) {
    payload.anonymous_id = uuidv4();
    payload.properties.timestamp = new Date().toISOString();
    payload.properties.session_id = getSessionId();
    this.outputChannel?.info(
      `Usage Tracking Payload: ${JSON.stringify(payload)}`
    );
    this.usageTrackingService.trackUsage(payload);
  }
}
