import * as vscode from 'vscode';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ChatManager } from '../chat/ChatManager';
import { InlineEditService } from '../services/inlineEdit/inlineEditService';
import { getActiveRepo } from '../utilities/contextManager';
import * as path from 'node:path';
import * as fs from 'fs';
import { SidebarProvider } from '../panels/SidebarProvider';
import { RelevantCodeSearcherToolService } from '../services/tools/relevantCodeSearcherTool/relevantCodeSearcherToolServivce';
import { SESSION_TYPE } from '../constants';
import { binaryApi } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { SearchTerm } from '../types';
import { AuthService } from '../services/auth/AuthService';
import { DiffManager } from '../diff/diffManager';
import { UsageTrackingManager } from '../analyticsTracking/UsageTrackingManager';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { calculateDiffMetric } from '../utilities/calculateDiffLinesNo';
import { ErrorTrackingManager } from '../analyticsTracking/ErrorTrackingManager';

interface InlineEditPayload {
  query: string;
  relevant_chunks: string[];
  llm_model: string;
  search_web: boolean;
  code_selection: {
    selected_text?: string;
    file_path?: string;
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
  private active_repo: string | undefined;
  private relative_file_path: string | undefined;
  private readonly authService = new AuthService();
  private readonly relevantCodeSearcherToolService: RelevantCodeSearcherToolService;

  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.LogOutputChannel,
    private readonly chatService: ChatManager,
    private readonly sidebarProvider: SidebarProvider,
    private readonly diffManager: DiffManager,
    private readonly usageTrackingManager: UsageTrackingManager,
    private readonly errorTrackingManager: ErrorTrackingManager,
    relevantCodeSearcherToolService: RelevantCodeSearcherToolService,
  ) {
    this.context = context;
    this.outputChannel = outputChannel;
    this.logger = SingletonLogger.getInstance();
    this.usageTrackingManager = usageTrackingManager;
    this.errorTrackingManager = errorTrackingManager;
    this.relevantCodeSearcherToolService = relevantCodeSearcherToolService;
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
      if (!this.editor) {
        return;
      }
      // Extracting file name
      const activeFileFullName = this.editor.document.fileName;
      const activeFileName = path.basename(activeFileFullName);
      this.outputChannel.info(`Active file path: ${activeFileName}`);

      this.active_repo = getActiveRepo();
      this.outputChannel.info(`Active repo: ${this.active_repo}`);
      // Get file path
      this.file_path = this.editor.document.uri.fsPath;
      if (!this.active_repo) {
        return;
      }
      // Extracting relativa path
      this.relative_file_path = path.relative(this.active_repo, this.file_path);
      this.outputChannel.info(`Relative path: ${this.relative_file_path}`);

      const selection = this.editor.selection;
      if (!selection) {
        return;
      }
      // Extracting selected text start and end line
      const start_line = selection.start.line;
      const end_line = selection.end.line;
      this.outputChannel.info(`start line = ${start_line}, end line = ${end_line}`);

      const inlineChatData = {
        keyword: activeFileName,
        path: this.relative_file_path,
        chunk: {
          file_path: this.relative_file_path,
          start_line: start_line + 1,
          end_line: end_line + 1,
          chunk_hash: `${this.relative_file_path}_${activeFileName}_${start_line + 1}_${end_line + 1}`,
        },
      };

      this.sidebarProvider.sendMessageToSidebar({
        id: uuidv4(),
        command: 'inline-chat-data',
        data: inlineChatData,
      });
    });
  }

  public async inlineEdit() {
    // Register the command for inline editing
    vscode.commands.registerCommand('deputydev.editThisCode', (collapse: boolean = false) => {
      this.logger.info('Edit command triggered');
      this.outputChannel.info('Edit command triggered');
      const commentController = vscode.comments.createCommentController('DeputyDevAI', 'DeputyDevAI Inline Edit');

      this.editor = vscode.window.activeTextEditor;
      if (!this.editor) {
        return;
      }

      this.active_repo = getActiveRepo();
      this.outputChannel.info(`Active repo: ${this.active_repo}`);
      // Get file path
      this.file_path = this.editor.document.uri.fsPath;
      if (!this.active_repo) {
        return;
      }
      this.relative_file_path = path.relative(this.active_repo, this.file_path);
      this.outputChannel.info(`Relative path: ${this.relative_file_path}`);

      this.focus_files = [];
      this.focus_files?.push(this.file_path);
      this.outputChannel.info(`Current Active File Path: ${this.file_path}`);
      this.outputChannel.info(`Current focus files: ${JSON.stringify(this.focus_files)}`);

      const selection = this.editor.selection;

      if (!selection) {
        return;
      }
      // Get selected text as a string
      this.selected_text = this.editor.document.getText(selection);
      if (this.selected_text) {
        this.focus_chunks = [];
        // Add selected text to focus_chunks array
        this.focus_chunks.push(this.selected_text);
        this.outputChannel.info(`Focus Chunks: ${JSON.stringify(this.focus_chunks)}`);
      }

      // Get the start and end positions of the selection
      this.startLineOfSelectedText = selection.start.line; // Start line number

      // Create a range using the start and end positions
      // Clamp to 0 so we don't go out of bounds at top of file
      const commentLine = Math.max(this.startLineOfSelectedText - 1, 0);
      // Use a zero-length range (same start and end) to anchor comment box
      this.range = new vscode.Range(new vscode.Position(commentLine, 0), new vscode.Position(commentLine, 0));

      // outputChannel.info(`Start Line: ${startLineOfSelectedText}, End Line: ${endLineOfSelectedText}`);

      if (!this.range) {
        return;
      }
      const comment_box_thread = commentController.createCommentThread(this.editor.document.uri, this.range, []);

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
      vscode.commands.registerCommand('deputydev.aiEdit', (reply: vscode.CommentReply) => {
        this.outputChannel.info('Now inside edit feature.....');
        this.active_repo = getActiveRepo();

        //Getting search web value from chat storage
        const chatStorage = this.context.workspaceState.get('chat-storage') as string;
        const parsedChatStorage = JSON.parse(chatStorage);
        const search_web = parsedChatStorage?.state?.search_web;

        //Getting active model value from chat type storage
        const chatTypeStorage = this.context.globalState.get('chat-type-storage') as string;
        const parsedChatTypeStorage = JSON.parse(chatTypeStorage);
        // let llm_model = parsedChatTypeStorage?.state?.activeModel;

        // if (llm_model === 'GEMINI_2_POINT_5_PRO') {
        //   llm_model = 'GPT_4_POINT_1';
        // }

        const payloadForInlineEdit: InlineEditPayload = {
          llm_model: 'GPT_4_POINT_1',
          search_web: search_web ? search_web : false,
          query: reply.text,
          relevant_chunks: [],
          code_selection: {
            selected_text: this.selected_text,
            file_path: this.relative_file_path,
          },
        };
        vscode.commands.executeCommand('deputydev.editThisCode', true);
        const thread = reply.thread;
        const docUri = thread.uri;
        const fileName = path.basename(docUri.fsPath);
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

  public async runTool(payload: any, sessionId?: number) {
    this.outputChannel.info(`Running tool: ${payload.content.tool_name}`);
    this.outputChannel.info(`Session ID: ${sessionId}`);

    if (!this.active_repo) {
      this.outputChannel.error('Active repo is not set.');
      throw new Error('Active repo is not set.');
    }

    let toolResult: any = null;
    switch (payload.content.tool_name) {
      case 'related_code_searcher': {
        try {
          const result = await this.relevantCodeSearcherToolService.runTool({
            repo_path: this.active_repo,
            query: payload.content.tool_input.search_query,
            focus_files: [],
            focus_directories: [],
            focus_chunks: [],
            session_id: sessionId,
            session_type: SESSION_TYPE,
          });

          toolResult = { RELEVANT_CHUNKS: result.relevant_chunks || [] };
        } catch (error) {
          const extraErrorInfo = {
            toolName: 'related_code_searcher',
            toolUseId: payload.content.tool_use_id,
          };
          this.errorTrackingManager.trackGeneralError(
            error,
            'INLINE_RELATED_CODE_SEARCHER_FAILED',
            'BINARY',
            extraErrorInfo,
          );
          toolResult = {
            RELEVANT_CHUNKS: [],
          };
        }
        break;
      }
      case 'focused_snippets_searcher':
        this.outputChannel.info(`Calling batch chunks search API.`);
        try {
          const authToken = await this.authService.loadAuthToken();
          const headers = { Authorization: `Bearer ${authToken}` };
          const response = await binaryApi().post(
            API_ENDPOINTS.BATCH_CHUNKS_SEARCH,
            {
              repo_path: this.active_repo,
              search_terms: payload.content.tool_input.search_terms as SearchTerm[],
            },
            { headers },
          );

          if (response.status === 200) {
            this.outputChannel.info('Batch chunks search API call successful.');
            toolResult = {
              batch_chunks_search: response.data,
            };
          } else {
            this.logger.error(`Batch chunks search API failed with status ${response.status}`);
            this.outputChannel.error(`Batch chunks search API failed with status ${response.status}`);
            throw new Error(`Batch chunks search failed with status ${response.status}`);
          }
        } catch (error: any) {
          const extraErrorInfo = {
            toolName: 'focused_snippets_searcher',
            toolUseId: payload.content.tool_use_id,
          };
          this.errorTrackingManager.trackGeneralError(
            error,
            'INLINE_FOCUSED_SNIPPET_SEARCHER_FAILED',
            'BINARY',
            extraErrorInfo,
          );
          toolResult = {
            batch_chunks_search: [],
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

          this.errorTrackingManager.trackGeneralError(
            new Error(errorMessage),
            'INLINE_MODIFY_FAILED',
            'EXTENSION',
            extraErrorInfo,
          );

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
            this.active_repo,
            toolInput.path,
            toolInput.start_line,
            toolInput.end_line,
          );
          const toolResponse =
            'Iterative file reader result: \n ' + JSON.stringify(iterativeFileReaderResult.data.chunk);
          toolResult = {
            iterative_file_reader_result: toolResponse,
          };
        } catch (error: any) {
          this.outputChannel.info(`Iterative file reader result at failed: ${error?.message || error}`);
          const extraErrorInfo = {
            toolName: 'iterative_file_reader',
            toolUseId: payload.content.tool_use_id,
          };
          this.errorTrackingManager.trackGeneralError(
            error,
            'INLINE_ITERATIVE_FILE_READER_FAILED',
            'BINARY',
            extraErrorInfo,
          );
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
            this.active_repo,
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
          this.errorTrackingManager.trackGeneralError(error, 'INLINE_REPLACE_IN_FILE_FAILED', 'BINARY', extraErrorInfo);
          this.outputChannel.error(`Failed to apply diff:\n${error?.message || error}`);
          toolResult = { FileEditResult: `Failed to apply diff:\n ${error?.message || String(error)}` };
        }
      }
    }
    return toolResult;
  }

  public async fetchInlineEditResult(
    payload: InlineEditPayload,
    session_id?: number,
    token?: vscode.CancellationToken,
  ): Promise<any> {
    const job = await this.inlineEditService.generateInlineEdit(payload, session_id);
    let inlineEditResponse;
    if (job.job_id) {
      inlineEditResponse = await this.pollInlineDiffResult(job.job_id, token);
    }
    if (inlineEditResponse.code_snippets) {
      for (const codeSnippet of inlineEditResponse.code_snippets) {
        const modified_file_path = codeSnippet.file_path;
        const raw_diff = codeSnippet.code;
        if (!modified_file_path || !raw_diff || !this.active_repo) {
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
          this.active_repo,
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
      const toolResult = await this.runTool(inlineEditResponse.tool_use_request, job.session_id);
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
