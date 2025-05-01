import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
import { ChatManager } from "../chat/ChatManager";
import { InlineEditService } from "../services/inlineEdit/inlineEditService";
import { getActiveRepo } from "../utilities/contextManager";
import * as path from "node:path";
import * as fs from "fs";
import { SidebarProvider } from "../panels/SidebarProvider";
import { Logger } from "../utilities/Logger";
import { fetchRelevantChunks } from "../clients/common/websocketHandlers";
import { SESSION_TYPE } from "../constants";
import { binaryApi } from "../services/api/axios";
import { API_ENDPOINTS } from "../services/api/endpoints";
import { SearchTerm } from "../types";
import { AuthService } from "../services/auth/AuthService";
import { DiffManager } from "../diff/diffManager";
interface InlineEditPayload {
  query: string;
  relevant_chunks: string[];
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

interface RelevantChunksPayload {
  focus_chunks?: string[];
  query: string;
  focus_files?: string[];
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
  private inlineEditService = new InlineEditService();
  private range: vscode.Range | undefined;
  private editor: vscode.TextEditor | undefined;
  private startLineOfSelectedText: number | undefined;
  private endLineOfSelectedText: number | undefined;
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.LogOutputChannel;
  private logger: Logger;
  private selected_text: string | undefined;
  private focus_chunks: string[] | undefined;
  private file_path: string | undefined;
  private focus_files: string[] | undefined;
  private active_repo: string | undefined;
  private relative_file_path: string | undefined;
  private authService = new AuthService();


  constructor(
    context: vscode.ExtensionContext,
    outputChannel: vscode.LogOutputChannel,
    logger: Logger,
    private readonly chatService: ChatManager,
    private readonly sidebarProvider: SidebarProvider,
    private readonly diffManager: DiffManager,
  ) {
    this.context = context;
    this.outputChannel = outputChannel;
    this.logger = logger;
  }

  public async inlineChatEditQuickFixes() {
    // Register the CodeActionsProvider for any language
    this.context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { scheme: "file", language: "*" },
        {
          provideCodeActions: (
            document: vscode.TextDocument,
            _range: vscode.Range,
            _context: vscode.CodeActionContext,
            _token: vscode.CancellationToken
          ): vscode.ProviderResult<vscode.CodeAction[]> => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return [];

            const selection = editor.selection;
            if (selection.isEmpty) return [];

            const selectedText = document.getText(selection);
            const codeActions: vscode.CodeAction[] = [];

            const actionChat = new vscode.CodeAction(
              "Chat using DeputyDev ⌘ L",
              vscode.CodeActionKind.QuickFix
            );
            actionChat.command = {
              command: "deputydev.chatWithDeputy",
              title: "Chat",
            };
            codeActions.push(actionChat);

            const isNonWhitespace = /\S/.test(selectedText);
            const isFile = document.uri.scheme === "file";
            const readOnly = isFile && isReadOnly(document.uri.fsPath);

            if (isNonWhitespace && (!isFile || !readOnly)) {
              const actionEdit = new vscode.CodeAction(
                "Modify using DeputyDev ⌘ I",
                vscode.CodeActionKind.QuickFix
              );
              actionEdit.command = {
                command: "deputydev.editThisCode",
                title: "Modify",
              };
              codeActions.push(actionEdit);
            }

            return codeActions;
          }

        }
      )
    );
  }

  public async inlineChat() {
    vscode.commands.registerCommand("deputydev.chatWithDeputy", async () => {
      this.sidebarProvider.setViewType("chat");
      await vscode.commands.executeCommand("deputydev-sidebar.focus");
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
      this.outputChannel.info(
        `start line = ${start_line}, end line = ${end_line}`
      );

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
        command: "inline-chat-data",
        data: inlineChatData,
      });
    });
  }

  public async inlineEdit() {
    // Register the command for inline editing
    vscode.commands.registerCommand(
      "deputydev.editThisCode",
      (collapse: boolean = false) => {
        this.logger.info("Edit command triggered");
        this.outputChannel.info("Edit command triggered");
        const commentController = vscode.comments.createCommentController(
          "DeputyDevAI",
          "DeputyDevAI Inline Edit"
        );

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
        this.relative_file_path = path.relative(
          this.active_repo,
          this.file_path
        );
        this.outputChannel.info(`Relative path: ${this.relative_file_path}`);

        this.focus_files = [];
        this.focus_files?.push(this.file_path);
        this.outputChannel.info(`Current Active File Path: ${this.file_path}`);
        this.outputChannel.info(
          `Current focus files: ${JSON.stringify(this.focus_files)}`
        );

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
          this.outputChannel.info(
            `Focus Chunks: ${JSON.stringify(this.focus_chunks)}`
          );
        }

        // Get the start and end positions of the selection
        this.startLineOfSelectedText = selection.start.line; // Start line number
        this.endLineOfSelectedText = selection.end.line; // End line number

        // Create a range using the start and end positions
        // Clamp to 0 so we don't go out of bounds at top of file
        const commentLine = Math.max(this.startLineOfSelectedText - 1, 0);
        // Use a zero-length range (same start and end) to anchor comment box
        this.range = new vscode.Range(
          new vscode.Position(commentLine, 0),
          new vscode.Position(commentLine, 0)
        );

        // outputChannel.info(`Start Line: ${startLineOfSelectedText}, End Line: ${endLineOfSelectedText}`);

        if (!this.range) {
          return;
        }
        const comment_box_thread = commentController.createCommentThread(
          this.editor.document.uri,
          this.range,
          []
        );

        commentController.options = {
          prompt: "Ask DeputyDev AI To Edit Your Code...",
        };

        if (collapse) {
          comment_box_thread.collapsibleState =
            vscode.CommentThreadCollapsibleState.Collapsed;
        } else {
          comment_box_thread.collapsibleState =
            vscode.CommentThreadCollapsibleState.Expanded;
        }
        this.outputChannel.info("Now getting out from comment box.....");
      }
    );

    // Register the command for AI editing
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "deputydev.aiEdit",
        (reply: vscode.CommentReply) => {
          this.outputChannel.info("Now inside edit feature.....");
          this.active_repo = getActiveRepo();
          const payloadForInlineEdit: InlineEditPayload = {
            query: reply.text,
            relevant_chunks: [],
            code_selection: {
              selected_text: this.selected_text,
              file_path: this.relative_file_path,
            },
          };
          vscode.commands.executeCommand("deputydev.editThisCode", true);
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Editing...",
              cancellable: true,
            },
            async () => {
              return await this.fetchInlineEditResult(payloadForInlineEdit);
            }
          );
        }
      )
    );
  }

  public async runTool(payload: any, sessionId?: number) {
    this.outputChannel.info(`Running tool: ${payload.content.tool_name}`);
    this.outputChannel.info(`Session ID: ${sessionId}`);

    if (!this.active_repo) {
      this.outputChannel.error("Active repo is not set.");
      throw new Error("Active repo is not set.");
    }

    let toolResult: any = null;
    switch (payload.content.tool_name) {
      case "related_code_searcher": {
        try {
          const result = await fetchRelevantChunks({
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
          toolResult = {
            RELEVANT_CHUNKS: [],
          };
        }
        break;
      }
      case "focused_snippets_searcher": {
        this.outputChannel.info(`Calling batch chunks search API.`);
        try {
          const authToken = await this.authService.loadAuthToken();
          const headers = { Authorization: `Bearer ${authToken}` };
          const response = await binaryApi().post(
            API_ENDPOINTS.BATCH_CHUNKS_SEARCH,
            {
              repo_path: this.active_repo,
              search_terms: payload.content.tool_input
                .search_terms as SearchTerm[],
            },
            { headers }
          );

          if (response.status === 200) {
            this.outputChannel.info("Batch chunks search API call successful.");
            toolResult = {
              batch_chunks_search: response.data,
            };
          } else {
            this.logger.error(
              `Batch chunks search API failed with status ${response.status}`
            );
            this.outputChannel.error(
              `Batch chunks search API failed with status ${response.status}`
            );
            throw new Error(
              `Batch chunks search failed with status ${response.status}`
            );
          }
        } catch (error: any) {
          toolResult = {
            batch_chunks_search: [],
          };
        }
      }
    }
    this.outputChannel.info(
      `Tool result: ${JSON.stringify(toolResult, null, 2)}`
    );
    return toolResult;
  }

  public async fetchInlineEditResult(
    payload: InlineEditPayload,
    session_id?: number
  ): Promise<any> {
    const job = await this.inlineEditService.generateInlineEdit(
      payload,
      session_id
    );
    let inlineEditResponse;
    if (job.job_id) {
      inlineEditResponse = await this.pollInlineDiffResult(job.job_id);
    }
    if (inlineEditResponse.code_snippets) {
      for (const codeSnippet of inlineEditResponse.code_snippets) {
        const modified_file_path = codeSnippet.file_path;
        const raw_diff = codeSnippet.code;
        if (!modified_file_path || !raw_diff || !this.active_repo) {
          this.outputChannel.error(
            "Modified file path, raw diff, or active repo is not set."
          );
          return;
        }
        this.diffManager.applyDiff({path: modified_file_path, incrementalUdiff: raw_diff}, this.active_repo, true);
      }
    }
    if (inlineEditResponse.tool_use_request) {
      this.outputChannel.info(
        "**************getting tool use request*************"
      );
      const toolResult = await this.runTool(
        inlineEditResponse.tool_use_request,
        job.session_id
      );
      payload.tool_use_response = {
        tool_name: inlineEditResponse.tool_use_request.content.tool_name,
        tool_use_id: inlineEditResponse.tool_use_request.content.tool_use_id,
        response: toolResult,
      };
      await this.fetchInlineEditResult(payload, job.session_id);
    }
  }

  public async pollInlineDiffResult(job_id: number) {
    const maxAttempts: number = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (job_id) {
          const response =
            await this.inlineEditService.getInlineDiffResult(job_id);

          if (response.status === "COMPLETED") {
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
