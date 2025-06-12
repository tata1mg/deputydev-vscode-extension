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
    const diff = wrapContentInDiffBlock(parsedContent.diff);

    if (sessionId) {
      this.usageTrackingManager.trackUsage({
        eventType: 'GENERATED',
        eventData: {
          file_path: vscode.workspace.asRelativePath(vscode.Uri.parse(parsedContent.path)),
          lines: parsedContent.diff.split('\n').length,
          source: toolRequest.is_inline ? 'inline-chat-act' : 'act',
        },
        sessionId: sessionId,
      });
    }

    try {
      const { diffApplySuccess, addedLines, removedLines } = await this.diffManager.applyDiffForSession(
        {
          path: parsedContent.path,
          search_and_replace_blocks: diff,
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
/**
 * Wraps the provided file content in a SEARCH_AND_REPLACE diff block,
 * which adds the content at the top of the file.
 *
 * @param content - The file content to insert
 * @returns The diff block string
 */
function wrapContentInDiffBlock(content: string): string {
  return ['<<<<<<< SEARCH', '=======', content, '>>>>>>> REPLACE'].join('\n');
}
