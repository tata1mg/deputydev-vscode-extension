import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import { ChunkCallback, ToolRequest } from '../../types';
import { getActiveRepo, getSessionId } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { SidebarProvider } from '../../panels/SidebarProvider';
import { UsageTrackingManager } from '../../analyticsTracking/UsageTrackingManager';
import { DiffManager } from '../../diff/diffManager';
import { AuthService } from '../../services/auth/AuthService';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { resolveDirectoryRelative } from '../../utilities/path';

interface ApplyDiffArgs {
  parsedContent: {
    path: string;
    diff: string;
  };
  chunkCallback: ChunkCallback;
  toolRequest: ToolRequest;
  messageId?: string;
}

export class WriteToFileTool {
  private usageTrackingManager: UsageTrackingManager;

  constructor(
    private context: ExtensionContext,
    private logger: ReturnType<typeof SingletonLogger.getInstance>,
    private outputChannel: vscode.LogOutputChannel,
    private sidebarProvider: SidebarProvider,
    private authService: AuthService,
    private diffManager: DiffManager,
  ) {
    this.logger = SingletonLogger.getInstance();
    this.usageTrackingManager = new UsageTrackingManager();
    this.sidebarProvider = sidebarProvider;
  }

  public async applyDiff(args: ApplyDiffArgs): Promise<string> {
    const { parsedContent, chunkCallback, toolRequest, messageId } = args;
    const activeRepo = getActiveRepo() || '';
    const sessionId = getSessionId();
    const diff = parsedContent.diff;
    const relativePath = resolveDirectoryRelative(parsedContent.path);
    if (sessionId) {
      this.usageTrackingManager.trackUsage({
        eventType: 'GENERATED',
        eventData: {
          file_path: relativePath,
          lines: parsedContent.diff.split('\n').length,
          source: toolRequest.is_inline ? 'inline-chat-act' : 'act',
        },
        sessionId: sessionId,
      });
    }

    try {
      const { diffApplySuccess, addedLines, removedLines } = await this.diffManager.applyDiffForSession(
        {
          path: relativePath,
          directReplace: diff,
        },
        activeRepo,
        {
          usageTrackingSource: toolRequest.is_inline ? 'inline-chat-act' : 'act',
          usageTrackingSessionId: sessionId || null,
        },
        toolRequest.write_mode,
        sessionId as number,
      );
      if (diffApplySuccess) {
        this.sidebarProvider?.sendMessageToSidebar({
          id: uuidv4(),
          command: 'file-diff-applied',
          data: {
            addedLines,
            removedLines,
            filePath: relativePath,
            fileName: path.basename(relativePath),
            repoPath: activeRepo,
            sessionId: sessionId,
          },
        });
      }
      this.sidebarProvider.sendMessageToSidebar({
        id: messageId,
        command: 'chunk',
        data: {
          name: 'APPLY_DIFF_RESULT',
          data: { status: 'completed', addedLines: addedLines, removedLines: removedLines },
        },
      });
      return 'successfully written the file, please continue with the next steps';
    } catch (error) {
      const enhancedErrorMessage = `Failed to write file.\n${(error as Error).message}`;
      this.logger.error(`Error applying diff: ${enhancedErrorMessage}`);

      this.sidebarProvider.sendMessageToSidebar({
        id: messageId,
        command: 'chunk',
        data: {
          name: 'APPLY_DIFF_RESULT',
          data: { status: 'error', addedLines: 0, removedLines: 0 },
        },
      });
      throw {
        response: {
          data: {
            error_code: (error as any)?.code || 500,
            error_type: (error as any)?.type || 'SERVER_ERROR',
            error_message: enhancedErrorMessage,
          },
        },
      };
    }
  }
}
