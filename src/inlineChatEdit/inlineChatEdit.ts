import * as vscode from 'vscode';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ChatManager } from '../chat/ChatManager';
import { InlineEditService } from '../services/inlineEdit/inlineEditService';
import * as path from 'node:path';
import * as fs from 'fs';
import { SidebarProvider } from '../panels/SidebarProvider';
import { AuthService } from '../services/auth/AuthService';
import { DiffManager } from '../diff/diffManager';
import { UsageTrackingManager } from '../analyticsTracking/UsageTrackingManager';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { calculateDiffMetric } from '../utilities/calculateDiffLinesNo';
import { ErrorTrackingManager } from '../analyticsTracking/ErrorTrackingManager';
import { LanguageFeaturesService } from '../languageServer/languageFeaturesService';
import { getIsEmbeddingDoneForActiveRepo } from '../utilities/contextManager';
import { GetUsagesTool } from '../chat/tools/usages/GetUsageTool';
import { GrepSearchTool } from '../chat/tools/GrepSearchTool';

interface InlineEditPayload {
  query: string;
  repo_path: string;
  relevant_chunks: string[];
  llm_model: string;
  search_web: boolean;
  is_lsp_ready: boolean;
  is_embedding_done: boolean;
  code_selection: {
    selected_text?: string;
    file_path?: string;
    line_range?: { start_line: number; end_line: number };
  };
  tool_use_response?: {
    tool_name: string;
    tool_use_id: string;
    response: {
      RELEVANT_CHUNKS: string[];
    };
  };
}

// Returns true if the file is read-only
function isReadOnly(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    // Check if file is readable (4), writable (2) for owner, group, others
    // 0o222 is octal for write bits (owner, group, others)
    return (stats.mode & 0o222) === 0;
  } catch (err) {
    return true; // if can't stat, assume read-only
  }
}

export class InlineChatEditManager {
  private readonly inlineEditService = new InlineEditService();
  private range: vscode.Range | undefined;
  private editor: vscode.TextEditor | undefined;
  private startLineOfSelectedText: number | undefined;
  private readonly context: vscode.ExtensionContext;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private selected_text: string | undefined;
  private focus_chunks: string[] | undefined;
  private file_path: string | undefined;
  private focus_files: string[] | undefined;
  private relative_file_path: string | undefined;
  private readonly authService = new AuthService();
  private readonly grepSearchTool: GrepSearchTool;
  private readonly languageFeaturesService = new LanguageFeaturesService();
  private readonly getUsagesTool = new GetUsagesTool(this.languageFeaturesService);
  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.LogOutputChannel,
    private readonly chatService: ChatManager,
    private readonly sidebarProvider: SidebarProvider,
    private readonly diffManager: DiffManager,
    private readonly usageTrackingManager: UsageTrackingManager,
    private readonly errorTrackingManager: ErrorTrackingManager,
  ) {
    this.context = context;
    this.outputChannel = outputChannel;
    this.logger = SingletonLogger.getInstance();
    this.usageTrackingManager = usageTrackingManager;
    this.errorTrackingManager = errorTrackingManager;
    this.grepSearchTool = new GrepSearchTool(this.outputChannel, this.authService);
  }

  public async inlineChatEditQuickFixes() {
    // Register the CodeActionsProvider for any language
    this.context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { scheme: 'file', language: '*' },
        {
          provideCodeActions: (
            document: vscode.TextDocument,
            _range: vscode.Range,
            _context: vscode.CodeActionContext,
            _token: vscode.CancellationToken,
          ): vscode.ProviderResult<vscode.CodeAction[]> => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) return [];

            const selection = editor.selection;
            if (selection.isEmpty) return [];

            const selectedText = document.getText(selection);
            const codeActions: vscode.CodeAction[] = [];

            const platform = os.platform();
            const actionChatText = platform === 'darwin' ? 'Chat using DeputyDev ⌘ L' : 'Chat using DeputyDev ctrl L';

            const actionChat = new vscode.CodeAction(actionChatText, vscode.CodeActionKind.QuickFix);
            actionChat.command = {
              command: 'deputydev.chatWithDeputy',
              title: 'Chat',
            };
            codeActions.push(actionChat);

            const isNonWhitespace = /\S/.test(selectedText);
            const isFile = document.uri.scheme === 'file';
            const readOnly = isFile && isReadOnly(document.uri.fsPath);

            const actionEditText =
              platform === 'darwin' ? 'Modify using DeputyDev ⌘ I' : 'Modify using DeputyDev ctrl I';

            if (isNonWhitespace && (!isFile || !readOnly)) {
              const actionEdit = new vscode.CodeAction(actionEditText, vscode.CodeActionKind.QuickFix);
              actionEdit.command = {
                command: 'deputydev.editThisCode',
                title: 'Modify',
              };
              codeActions.push(actionEdit);
            }

            return codeActions;
          },
        },
      ),
    );
  }

  public async inlineChat() {
    vscode.commands.registerCommand('deputydev.chatWithDeputy', async () => {
      this.sidebarProvider.setViewType('chat');
      await vscode.commands.executeCommand('deputydev-sidebar.focus');
      this.editor = vscode.window.activeTextEditor;
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        this.outputChannel.warn('No active text editor found.');
        return;
      }
      const document = editor.document;
      const fileUri = document.uri;

      // Full and relative paths
      const filePath = fileUri.fsPath;
      const fileName = path.basename(filePath);

      this.outputChannel.info(`Active file: ${fileName}`);

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
      const repoPath = workspaceFolder?.uri.fsPath ?? '';

      if (!repoPath) {
        this.outputChannel.warn('No workspace folder found for active file.');
        return;
      }

      this.outputChannel.info(`Active repo: ${repoPath}`);

      const relativePath = path.relative(repoPath, filePath);
      this.outputChannel.info(`Relative path: ${relativePath}`);

      const selection = editor.selection;
      if (!selection) {
        return;
      }
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;
      // Extracting selected text start and end line
      const start_line = selection.start.line;
      const end_line = selection.end.line;
      this.outputChannel.info(`start line = ${start_line}, end line = ${end_line}`);

      const inlineChatData = {
        keyword: fileName,
        path: relativePath,
        chunk: {
          file_path: relativePath,
          start_line: startLine,
          end_line: endLine,
          chunk_hash: `${relativePath}_${fileName}_${startLine}_${endLine}`,
        },
      };

      this.sidebarProvider.sendMessageToSidebar({
        id: uuidv4(),
        command: 'inline-chat-data',
        data: inlineChatData,
      });
    });
  }

  public async inlineEdit(): Promise<void> {
    // Register the command for inline editing
    vscode.commands.registerCommand('deputydev.editThisCode', (collapse: boolean = false) => {
      this.logger.info('Edit command triggered');
      this.outputChannel.info('Edit command triggered');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        this.outputChannel.warn('No active text editor found.');
        return;
      }
      const document = editor.document;
      const fileUri = document.uri;
      const filePath = fileUri.fsPath;
      this.outputChannel.info(`File path: ${filePath}`);
      this.outputChannel.info(`File URI: ${fileUri.toString()}`);
      // --- Get repo path ---
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
      const repoPath = workspaceFolder?.uri.fsPath;
      if (!repoPath) {
        this.outputChannel.warn('No workspace folder found for active file.');
        return;
      }
      this.outputChannel.info(`Active repo: ${repoPath}`);
      // --- Relative path ---
      const relativePath = path.relative(repoPath, filePath);
      this.relative_file_path = relativePath;
      this.outputChannel.info(`Relative path: ${relativePath}`);

      this.focus_files = [filePath];
      this.outputChannel.info(`Current focus files: ${JSON.stringify(this.focus_files)}`);

      const selection = editor.selection;
      if (selection.isEmpty) {
        this.outputChannel.warn('No text selected for inline edit.');
        return;
      }
      // Get selected text as a string
      this.selected_text = editor.document.getText(selection);
      if (!this.selected_text.trim()) {
        this.outputChannel.warn('Selected text is empty.');
        return;
      }

      this.focus_chunks = [this.selected_text];
      this.outputChannel.info(`Focus chunks: ${JSON.stringify(this.focus_chunks)}`);

      // --- Anchor comment thread above selection ---
      const commentController = vscode.comments.createCommentController('DeputyDevAI', 'DeputyDevAI Inline Edit');
      // Get the start and end positions of the selection

      // Create a range using the start and end positions
      // Clamp to 0 so we don't go out of bounds at top of file
      const commentLine = Math.max(selection.start.line - 1, 0);

      // Use a zero-length range (same start and end) to anchor comment box
      this.range = new vscode.Range(new vscode.Position(commentLine, 0), new vscode.Position(commentLine, 0));

      // outputChannel.info(`Start Line: ${startLineOfSelectedText}, End Line: ${endLineOfSelectedText}`);

      if (!this.range) {
        return;
      }
      const comment_box_thread = commentController.createCommentThread(editor.document.uri, this.range, []);

      commentController.options = {
        prompt: 'Ask DeputyDev AI To Edit Your Code...',
      };

      if (collapse) {
        comment_box_thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      } else {
        comment_box_thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      }
      this.outputChannel.info('Now getting out from comment box.....');
    });

    // Register the command for AI editing
    this.context.subscriptions.push(
      vscode.commands.registerCommand('deputydev.aiEdit', async (reply: vscode.CommentReply) => {
        this.outputChannel.info('Now inside edit feature.....');
        const thread = reply.thread;
        const docUri = thread.uri;

        if (!docUri) {
          this.outputChannel.warn('No document URI found in comment thread.');
          return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
        const repoPath = workspaceFolder?.uri.fsPath ?? '';

        if (!repoPath) {
          this.outputChannel.warn(`No workspace folder found for file: ${docUri.fsPath}`);
          return;
        }
        this.outputChannel.info(`Resolved repo path from thread: ${repoPath}`);
        const documentSymbols = await this.languageFeaturesService.getDocumentSymbols(docUri);
        const isLspReady = Array.isArray(documentSymbols) && documentSymbols.length > 0;
        const isEmbeddingDone = getIsEmbeddingDoneForActiveRepo(repoPath);
        const fileName = path.basename(docUri.fsPath);
        const payloadForInlineEdit: InlineEditPayload = {
          llm_model: 'GPT_4_POINT_1',
          search_web: false,
          query: reply.text,
          repo_path: repoPath,
          is_lsp_ready: isLspReady,
          is_embedding_done: isEmbeddingDone,
          relevant_chunks: [],
          code_selection: {
            selected_text: this.selected_text,
            file_path: this.relative_file_path,
            line_range: this.range
              ? { start_line: this.range.start.line + 1, end_line: this.range.end.line + 1 }
              : undefined,
          },
        };
        this.outputChannel.info(`Payload for inline edit: ${JSON.stringify(payloadForInlineEdit, null, 2)}`);
        reply.thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Editing ${path.basename(fileName)}...`,
            cancellable: true,
          },
          async (progress, token) => {
            return await this.fetchInlineEditResult(payloadForInlineEdit, /* session_id */ undefined, token);
          },
        );
      }),
    );
  }

  public async runTool(payload: any, repoPath: string, sessionId?: number): Promise<any> {
    this.outputChannel.info(`Running tool: ${payload.content.tool_name}`);
    this.outputChannel.info(`Session ID: ${sessionId}`);

    let toolResult: any = null;
    switch (payload.content.tool_name) {
      case 'grep_search': {
        try {
          toolResult = this.grepSearchTool.runGrepSearch({
            search_path: payload.content.tool_input.search_path,
            repoPath: repoPath,
            query: payload.content.tool_input.query,
            case_insensitive: payload.content.tool_input.case_insensitive,
            use_regex: payload.content.tool_input.use_regex,
          });
        } catch (error) {
          const extraErrorInfo = {
            toolName: 'grep_search',
            toolUseId: payload.content.tool_use_id,
          };

          this.errorTrackingManager.trackGeneralError({
            error,
            errorType: 'INLINE_GREP_SEARCH_FAILED',
            errorSource: 'BINARY',
            extraData: extraErrorInfo,
            repoPath: repoPath,
            sessionId: sessionId,
          });
          toolResult = {
            GREP_SEARCH: [],
          };
        }
        break;
      }
      case 'get_usage_tool':
        try {
          toolResult = await this.getUsagesTool.getUsages({
            symbolName: payload.content.tool_input.symbol_name,
            filePaths: payload.content.tool_input.file_paths,
          });
        } catch (error: any) {
          const extraErrorInfo = {
            toolName: 'get_usage_tool',
            toolUseId: payload.content.tool_use_id,
          };
          this.errorTrackingManager.trackGeneralError({
            error,
            errorType: 'INLINE_GET_USAGES_TOOL_FAILED',
            errorSource: 'EXTENSION',
            extraData: extraErrorInfo,
            repoPath: repoPath,
            sessionId: sessionId,
          });
          toolResult = {
            get_usage_tool_result: ['Failed to fetch usages: ' + (error?.message || String(error))],
          };
        }
        break;
      case 'task_completion': {
        this.outputChannel.info(`task_completion with params: ${JSON.stringify(payload, null, 2)}`);
        const status = payload.content.tool_input.status;
        if (status === 'completed') {
          this.outputChannel.info(`Inline Task completed successfully.`);
          vscode.window.showInformationMessage('File modified successfully.');
        }
        if (status === 'failed') {
          const { tool_use_id, tool_input } = payload.content;
          const extraErrorInfo = {
            toolName: 'task_completion',
            toolUseId: tool_use_id,
          };

          const errorMessage = tool_input.message
            ? `Inline modify failed. ${tool_input.message}`
            : 'Inline modify failed. as per LLM response';

          this.errorTrackingManager.trackGeneralError({
            error: new Error(errorMessage),
            errorType: 'INLINE_MODIFY_FAILED',
            errorSource: 'EXTENSION',
            extraData: extraErrorInfo,
            repoPath: repoPath,
            sessionId: sessionId,
          });

          this.outputChannel.error('Inline Task failed.');
          vscode.window.showErrorMessage('Failed to modify the file.');
        }

        setTimeout(() => {
          vscode.commands.executeCommand('workbench.action.closeNotification');
        }, 5000); // 5 seconds
        break;
      }
      case 'iterative_file_reader':
        try {
          this.outputChannel.info(
            `Running iterative_file_reader with params in inline editor: ${JSON.stringify(payload.content.tool_input)}`,
          );
          const toolInput = payload.content.tool_input;
          const iterativeFileReaderResult = await this.chatService._runIterativeFileReader(
            repoPath,
            toolInput.file_path,
            toolInput.start_line,
            toolInput.end_line,
          );
          const toolResponse =
            'Iterative file reader result: \n ' + JSON.stringify(iterativeFileReaderResult.data.chunk);
          toolResult = {
            iterative_file_reader_result: toolResponse,
          };
        } catch (error: any) {
          this.outputChannel.info(`Iterative file reader result at failed: ${error}`);
          const extraErrorInfo = {
            toolName: 'iterative_file_reader',
            toolUseId: payload.content.tool_use_id,
          };
          this.errorTrackingManager.trackGeneralError({
            error: error,
            errorType: 'INLINE_ITERATIVE_FILE_READER_FAILED',
            errorSource: 'BINARY',
            extraData: extraErrorInfo,
            repoPath: repoPath,
            sessionId: sessionId,
          });
          toolResult = {
            iterative_file_reader_result: `Failed to read file: ${error?.message || error}. \n If repeated failures occur, invoke the "task_completion" tool with status "failed".  \n Otherwise, try reading the latest content with the "iterative_file_reader" tool before retrying your modification.`,
          };
        }

        break;
      case 'replace_in_file': {
        const diffPayload = payload.content.tool_input.diff;
        const diffFilePath = payload.content.tool_input.path;
        this.outputChannel.info(`Running replace_in_file with params: ${JSON.stringify(payload, null, 2)}`);
        if (sessionId) {
          this.usageTrackingManager.trackUsage({
            eventType: 'GENERATED',
            eventData: {
              file_path: diffFilePath,
              lines: calculateDiffMetric(diffPayload),
              source: 'inline-modify',
            },
            sessionId: sessionId,
          });
        }
        try {
          this.outputChannel.info(`Applying diff to file: ${diffFilePath}`);
          await this.diffManager.applyDiff(
            {
              path: diffFilePath,
              search_and_replace_blocks: diffPayload,
            },
            repoPath,
            true,
            {
              usageTrackingSessionId: sessionId ?? null,
              usageTrackingSource: 'inline-modify',
            },
            true,
          );
          toolResult = {
            FileEditResult:
              'Successfully modified the file, please continue with the next steps, incase no more changes are needed,  call this **task_completion** with status as "completed". ',
          };
        } catch (error: any) {
          const extraErrorInfo = {
            toolName: 'replace_in_file',
            toolUseId: payload.content.tool_use_id,
          };
          this.errorTrackingManager.trackGeneralError({
            error: error,
            errorType: 'INLINE_REPLACE_IN_FILE_FAILED',
            errorSource: 'BINARY',
            extraData: extraErrorInfo,
            repoPath: repoPath,
            sessionId: sessionId,
          });
          this.outputChannel.error(`Failed to apply diff:\n${error?.message || error}`);
          toolResult = { FileEditResult: `Failed to apply diff:\n ${error?.message || String(error)}` };
        }
      }
    }
    return toolResult;
  }

  public async fetchInlineEditResult(
    payload: InlineEditPayload,
    sessionId?: number,
    token?: vscode.CancellationToken,
  ): Promise<any> {
    const job = await this.inlineEditService.generateInlineEdit(payload, sessionId);
    let inlineEditResponse;
    if (job.job_id) {
      inlineEditResponse = await this.pollInlineDiffResult(job.job_id, token);
    }
    if (inlineEditResponse.code_snippets) {
      for (const codeSnippet of inlineEditResponse.code_snippets) {
        const modified_file_path = codeSnippet.file_path;
        const raw_diff = codeSnippet.code;
        if (!modified_file_path || !raw_diff || !payload.repo_path) {
          this.outputChannel.error('Modified file path, raw diff, or active repo is not set.');
          return;
        }
        const rawUdiffLines: string[] = raw_diff.split('\n');
        const modifiedLinesCount = rawUdiffLines.filter(
          (line: string) => line.startsWith('+') || line.startsWith('-'),
        ).length;
        this.usageTrackingManager.trackUsage({
          eventType: 'GENERATED',
          eventData: {
            file_path: modified_file_path,
            lines: modifiedLinesCount,
            source: 'inline-modify',
          },
          sessionId: job.session_id,
        });
        this.diffManager.applyDiff(
          { path: modified_file_path, search_and_replace_blocks: raw_diff },
          payload.repo_path,
          true,
          {
            usageTrackingSessionId: job.session_id,
            usageTrackingSource: 'inline-modify',
          },
          true,
        );
      }
    }
    if (inlineEditResponse.tool_use_request) {
      const toolResult = await this.runTool(inlineEditResponse.tool_use_request, payload.repo_path, job.session_id);
      if (inlineEditResponse.tool_use_request.content.tool_name === 'task_completion') {
        return;
      }
      payload.tool_use_response = {
        tool_name: inlineEditResponse.tool_use_request.content.tool_name,
        tool_use_id: inlineEditResponse.tool_use_request.content.tool_use_id,
        response: toolResult,
      };
      await this.fetchInlineEditResult(payload, job.session_id);
    }
  }

  public async pollInlineDiffResult(job_id: number, token?: vscode.CancellationToken) {
    const maxAttempts: number = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check for cancellation at the start of each loop
      if (token && token.isCancellationRequested) {
        // Optional: Do any cleanup here
        this.outputChannel.info('Polling cancelled by user.');
        return; // or throw new Error('Cancelled') if you want to propagate
      }
      try {
        if (job_id) {
          const response = await this.inlineEditService.getInlineDiffResult(job_id);

          if (response.status === 'COMPLETED') {
            if (response.response) {
              return response.response;
            }
          }
        }
      } catch (error) {
        // console.error('Error while polling session:', error);
      }

      // Wait for 3 seconds before the next attempt
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
