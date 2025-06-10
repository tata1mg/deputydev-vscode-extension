import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';
import { ChunkCallback, ToolRequest } from '../../types';
import { getActiveRepo, getSessionId } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { SidebarProvider } from '../../panels/SidebarProvider';
import { UsageTrackingManager } from '../../analyticsTracking/UsageTrackingManager';
import { DiffManager } from '../../diff/diffManager';
import { AuthService } from '../../services/auth/AuthService';
import { calculateDiffMetric } from '../../utilities/calculateDiffLinesNo';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

interface ApplyDiffArgs {
  parsedContent: {
    path: string;
    diff: string;
  };
  chunkCallback: ChunkCallback;
  toolRequest: ToolRequest;
  messageId?: string;
}

export class ReplaceInFile {
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

    if (sessionId) {
      this.usageTrackingManager.trackUsage({
        eventType: 'GENERATED',
        eventData: {
          file_path: vscode.workspace.asRelativePath(vscode.Uri.parse(parsedContent.path)),
          lines: calculateDiffMetric(parsedContent.diff),
          source: toolRequest.is_inline ? 'inline-chat-act' : 'act',
        },
        sessionId: sessionId,
      });
    }
    try {
      const { diffApplySuccess, addedLines, removedLines } = await this.diffManager.applyDiffForSession(
        {
          path: parsedContent.path,
          search_and_replace_blocks: parsedContent.diff,
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
            filePath: parsedContent.path,
            fileName: path.basename(parsedContent.path),
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
      return 'successfully modified the file, please continue with the next steps';
    } catch (error) {
      const enhancedErrorMessage = `Failed to apply changes. Please read the conflicting file content first using the iterative_file_reader tool.\n${(error as Error).message}`;
      this.logger.error(`Error applying diff: ${enhancedErrorMessage}`);

      this.sidebarProvider.sendMessageToSidebar({
        id: messageId,
        command: 'chunk',
        data: {
          name: 'APPLY_DIFF_RESULT',
          data: { status: 'error', addedLines: 0, removedLines: 0 },
        },
      });
      // Optionally: rethrow if the caller of this method needs to handle it too
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
