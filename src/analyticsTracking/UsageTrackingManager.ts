import { UsageTrackingService } from '../services/usageTracking/UsageTrackingService';
import * as vscode from 'vscode';
import { UsageTrackingRequest } from '../types';
import { CLIENT, CLIENT_VERSION } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class UsageTrackingManager {
  onStarted: () => void = () => {};
  onError: (error: Error) => void = () => {};
  private usageTrackingService = new UsageTrackingService();

  constructor(
    private context?: vscode.ExtensionContext,
    private outputChannel?: vscode.LogOutputChannel,
  ) {}

  async trackUsage(payload: UsageTrackingRequest) {
    const usageTrackingPayload = {
      event_id: uuidv4(),
      event_type: payload.eventType,
      event_data: payload.eventData,
      session_id: payload.sessionId,
      client: CLIENT,
      client_version: CLIENT_VERSION,
      timestamp: new Date().toISOString(),
      user_team_id: 1,
    };
    this.outputChannel?.info(`Usage Tracking Payload: ${JSON.stringify(usageTrackingPayload)}`);
    this.usageTrackingService.trackUsage(usageTrackingPayload);
  }
}
