import * as vscode from 'vscode';
import { ChatManager } from '../chat/ChatManager';
import { InlineEditService } from '../services/inlineEdit/inlineEditService';

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
    private relevant_chunks: RelevantChunk[] | undefined;
    private selected_text: string | undefined;
    private focus_chunks: string[] | undefined;
    private file_path: string | undefined;
    private focus_files: string[] | undefined;
    constructor(
        context: vscode.ExtensionContext,
        outputChannel: vscode.LogOutputChannel,
        private chatService: ChatManager
    ) {
        this.context = context;
        this.outputChannel = outputChannel;
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

            // Get file path
            this.file_path = this.editor.document.uri.fsPath;
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
            const thread = commentController.createCommentThread(
                this.editor.document.uri,
                this.range,
                []
            );

            commentController.options = {
                prompt: "Ask DeputyDev AI To Edit Your Code..."
            };

            thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
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
                // const result = await this.chatService.processRelevantChunks({
                //     focus_chunks : this.focus_chunks,
                //     query : reply.text,
                //     focus_files : this.focus_files
                // })
                this.relevant_chunks = [
                    {
                        content: "    def __set_corporate_id(self):\n        x_corporate_id = self.request.headers.get(\"X-CORPORATE-ID\", None)\n        setattr(self, \"x_corporate_id\", x_corporate_id)",
                        embedding: null,
                        source_details: {
                            file_path: "app/common/helpers/header_attributes.py",
                            file_hash: "31ead26d0c5039175ea391d2d2bdca527b7b05b4",
                            start_line: 152,
                            end_line: 154
                        },
                        metadata: null,
                        search_score: 0.699999988079071
                    },
                    {
                        content: "                    {\n                        \"id\": 31283,\n                        \"name\": \"CECT Neck\",\n                        \"mix_panel_data\": {\n                            \"sku_id\": 31283,\n                            \"sku_name\": \"CECT Neck\",\n                            \"position\": 9,\n                            \"mrp\": \"\\\u20b92200.0\",\n                            \"discount\": \"10% off\",\n                        },\n                        \"info\": null,\n                        \"tag\": null,\n                        \"category\": \"Radiology\",\n                        \"test_type\": \"generic_test\",\n                        \"search_type\": \"sku\",\n                        \"url\": \"/labs/test/31283\",\n                        \"image\": \"https://onemg.gumlet.io/assets/ec7331ae-6882-11ec-82c2-0a3c85ad997a.png?format=auto\",\n                        \"subheading\": {\"text\": \"Contains 1 tests\", \"data\": null},\n                        \"prices\": {\n                            \"mrp\": \"\\\u20b92200.0\",\n                            \"discounted_price\": \"\\\u20b91980.0\",\n                            \"discount\": \"10% off\",\n                        },\n                        \"eta\": {\"text\": \"Report within <b> 24.0 hours </b>\"},\n                    },\n                ],",
                        embedding: null,
                        source_details: {
                            file_path: "app/tests/third_party_methods/search_client_test.py",
                            file_hash: "6f308e141a0b030e040dc4da9561008c0eaa013f",
                            start_line: 6398,
                            end_line: 6423
                        },
                        metadata: null,
                        search_score: 0.6903731226921082
                    }
                ];
                this.outputChannel.info(`Relevant chunks: ${JSON.stringify(this.relevant_chunks.slice(0, 1))}`);
                const job = await this.inlineEditService.generateInlineEdit({
                    "query": reply.text,
                    "relevant_chunks": this.relevant_chunks,
                    "code_selection": this.selected_text
                })
                this.outputChannel.info(`Job_id: ${job.job_id}`)
                let uDiff;
                if (job.job_id) {
                    uDiff = await this.pollInlineDiffResult(job.job_id);
                }
                this.outputChannel.info(`UDIFF: ${JSON.stringify(uDiff, null, 2)}`);
            });
        }));
    }

    public async pollInlineDiffResult(job_id: number) {
        const maxAttempts: number = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                if (job_id) {
                    const response = await this.inlineEditService.getInlineDiffResult(job_id)

                    if (response.status === 'COMPLETED') {
                        if (response.result) {
                            return response.result
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