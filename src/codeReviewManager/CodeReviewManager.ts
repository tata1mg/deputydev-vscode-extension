import * as vscode from 'vscode';
import { CodeReviewWebsocketService, ReviewEvent } from '../services/codeReview/websocket/CodeReviewWebsocket';
import { BackendClient } from '../clients/backendClient';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { SidebarProvider } from '../panels/SidebarProvider';
import { AuthService } from '../services/auth/AuthService';
import { AgentPayload } from '../types';

export class CodeReviewManager {
  private readonly reviewService: CodeReviewWebsocketService;
  private sidebarProvider?: SidebarProvider; // Optional at first
  private readonly authService = new AuthService();
  private currentAbortController: AbortController | null = null;
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly outputChannel: vscode.LogOutputChannel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    outputChannel: vscode.LogOutputChannel,
    backendClient: BackendClient,
  ) {
    this.outputChannel = outputChannel;
    this.logger = SingletonLogger.getInstance();
    this.reviewService = new CodeReviewWebsocketService(context, outputChannel, backendClient);
  }

  // Method to set the sidebar provider later
  setSidebarProvider(sidebarProvider: SidebarProvider) {
    this.sidebarProvider = sidebarProvider;
  }

  public async startCodeReview(agentsPayload: { agents: AgentPayload[] }): Promise<void> {
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      this.outputChannel.info('Starting code review...');

      for await (const event of this.reviewService.startReview(agentsPayload, abortController.signal)) {
        await this.handleReviewEvent(event);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.outputChannel.info('Review was cancelled by user');
        return;
      }
      this.outputChannel.error(`Review error: ${error.message}`, error);
    } finally {
      this.cleanup();
    }
  }

  public async cancelCurrentReview(): Promise<void> {
    if (this.currentAbortController) {
      this.outputChannel.info('Cancelling current review...');
      this.currentAbortController.abort();
      this.cleanup();
    }
  }

  private async handleReviewEvent(event: ReviewEvent): Promise<void> {
    this.outputChannel.debug(`Processing review event: ${event.type}`);

    console.log(`Received review event: ${event.type}`, event);

    switch (event.type) {
      case 'AGENT_COMPLETED':
        this.outputChannel.info('Review completed successfully');
        vscode.window.showInformationMessage('Code review completed!');
        break;

      case 'AGENT_FAILED':
        this.outputChannel.error(`Review failed: ${event.error || 'Unknown error'}`);
        vscode.window.showErrorMessage(`Code review failed: ${event.error}`);
        break;

      case 'TOOL_USE_REQUEST':
        if (event.tool_use_id && event.content) {
          this.outputChannel.info(`Tool use requested: ${event.content.tool_name}`);
          // Call tool use handler to fetch tool use response from binary
        }
        break;
    }
  }

  private cleanup(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  public dispose(): void {
    this.cleanup();
    this.reviewService.dispose();
  }
}
