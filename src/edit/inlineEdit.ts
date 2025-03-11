import * as vscode from 'vscode';
import { ChatManager } from '../chat/ChatManager';
import { InlineEditService } from '../services/inlineEdit/inlineEditService';
import { getActiveRepo } from '../utilities/contextManager';
import * as path from 'node:path';

interface RelevantChunk {
    content: string;
    embedding: any;
    source_details: {
        file_path: string;
        file_hash: string;
        start_line: number;
        end_line: number;
    };
    metadata: any;
    search_score: number;
}

export class InlineEditManager {
    private inlineEditService = new InlineEditService();
    private range: vscode.Range | undefined;
    private editor: vscode.TextEditor | undefined;
    private startLineOfSelectedText: number | undefined;
    private endLineOfSelectedText: number | undefined;
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.LogOutputChannel;
    private selected_text: string | undefined;
    private focus_chunks: string[] | undefined;
    private file_path: string | undefined;
    private focus_files: string[] | undefined;
    private active_repo: string | undefined;
    private relative_file_path: string | undefined
    private comment_box_thread: vscode.CommentThread | undefined
    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.LogOutputChannel,
        private chatService: ChatManager
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
    }

    public async codeLenseForInlineEdit() {
        // Register the CodeLensProvider for any language
        this.context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file', language: '*' }, {
            provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
                const codeLenses: vscode.CodeLens[] = [];
                const selection = vscode.window.activeTextEditor?.selection;

                if (selection && !selection.isEmpty) {
                    const range = new vscode.Range(selection.start.line, 0, selection.end.line, 0);

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: 'Edit',
                            command: 'deputydev.editThisCode',
                            arguments: [document.uri.toString(), selection.start.line, selection.end.line],
                        }),
                        new vscode.CodeLens(range, {
                            title: 'Chat',
                            command: 'deputydev.chat',
                            arguments: [document.uri.toString(), selection.start.line, selection.end.line],
                        }),
                    );
                }

                return codeLenses.length > 0 ? codeLenses : [];
            }
        }));

        // Listen for selection changes
        this.context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
            const editor = event.textEditor;
            const selection = editor.selection;

            // Trigger a refresh of CodeLenses
            vscode.commands.executeCommand('vscode.executeCodeLensProvider', editor.document.uri);
        }));

        // Also listen for when the active editor changes
        this.context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                vscode.commands.executeCommand('vscode.executeCodeLensProvider', editor.document.uri);
            }
        }));

        // Listen for document changes to clear CodeLenses when nothing is selected
        this.context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === event.document) {
                vscode.commands.executeCommand('vscode.executeCodeLensProvider', editor.document.uri);
            }
        }));
    }

    public async editThisCode() {
        // Register the command for inline editing
        vscode.commands.registerCommand('deputydev.editThisCode', () => {
            this.outputChannel.info('Edit command triggered');
            const commentController = vscode.comments.createCommentController('DeputyDevAI', 'DeputyDevAI Inline Edit');

            this.editor = vscode.window.activeTextEditor;
            if (!this.editor) {
                return;
            }

            this.active_repo = getActiveRepo();
            this.outputChannel.info(`Active repo: ${this.active_repo}`)
            // Get file path
            this.file_path = this.editor.document.uri.fsPath;
            if (!this.active_repo) {
                return
            }
            this.relative_file_path = path.relative(this.active_repo, this.file_path);
            this.outputChannel.info(`Relative path: ${this.relative_file_path}`)


            this.focus_files = []
            this.focus_files?.push(this.file_path)
            this.outputChannel.info(`Current Active File Path: ${this.file_path}`);
            this.outputChannel.info(`Current focus files: ${JSON.stringify(this.focus_files)}`)

            const selection = this.editor.selection;

            if (selection && !selection.isEmpty) {
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
                this.endLineOfSelectedText = selection.end.line; // End line number

                // Create a range using the start and end positions
                this.range = new vscode.Range(
                    new vscode.Position(this.startLineOfSelectedText, 0),
                    new vscode.Position(this.endLineOfSelectedText, 0)
                );

                // outputChannel.info(`Start Line: ${startLineOfSelectedText}, End Line: ${endLineOfSelectedText}`);
            }
            if (!this.range) {
                return;
            }
            this.comment_box_thread = commentController.createCommentThread(
                this.editor.document.uri,
                this.range,
                []
            );

            commentController.options = {
                prompt: "Ask DeputyDev AI To Edit Your Code..."
            };

            this.comment_box_thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
        });

        // Register the command for AI editing
        this.context.subscriptions.push(vscode.commands.registerCommand('deputydev.aiEdit', (reply: vscode.CommentReply) => {
            this.outputChannel.info(`USER QUERY: ${reply.text}`);
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Editing...",
                cancellable: true
            }, async () => {
                this.outputChannel.info("Inside function")
                const relevant_chunks = await this.chatService.processRelevantChunks({
                    focus_chunks: this.focus_chunks,
                    query: reply.text,
                    focus_files: this.focus_files
                })
                const job = await this.inlineEditService.generateInlineEdit({
                    "query": reply.text,
                    "relevant_chunks": relevant_chunks,
                    "code_selection": {
                        "selected_text": this.selected_text,
                        "file_path": this.relative_file_path,
                    },
                })
                this.outputChannel.info(`Job_id: ${job.job_id}`)

                let uDiff;
                if (job.job_id) {
                    uDiff = await this.pollInlineDiffResult(job.job_id);
                }

                this.outputChannel.info(`UDIFF: ${JSON.stringify(uDiff, null, 2)}`);

                this.outputChannel.info(`Active Repo: ${this.active_repo}`)

                const modified_file_path = uDiff.code_snippets[0].file_path
                const raw_diff = uDiff.code_snippets[0].code

                this.outputChannel.info(`File_path: ${modified_file_path}`)
                this.outputChannel.info(`raw_diff: ${raw_diff}`)

                if (!modified_file_path) {
                    return
                }
                const modifiedFiles = await this.chatService.getModifiedRequest({
                    filepath: modified_file_path,
                    raw_diff: raw_diff,
                }) as Record<string, string>;

                if (!this.active_repo) {
                    return
                }
                this.chatService.handleModifiedFiles(modifiedFiles, this.active_repo)
            });
        }));
    }

    public async pollInlineDiffResult(job_id: number) {
        const maxAttempts: number = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                if (job_id) {
                    const response = await this.inlineEditService.getInlineDiffResult(job_id)

                    if (response.status === 'COMPLETED') {
                        if (response.response) {
                            return response.response
                        }
                    }
                }
            } catch (error) {
                console.error('Error while polling session:', error);
            }

            // Wait for 3 seconds before the next attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}