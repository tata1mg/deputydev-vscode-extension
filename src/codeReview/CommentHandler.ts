import * as vscode from 'vscode';
import * as path from 'path';
import { getActiveRepo } from '../utilities/contextManager';

export class CommentHandler {
  private commentController: vscode.CommentController;
  private _onDidChangeCommentThreads = new vscode.EventEmitter<vscode.CommentThread>();
  public onDidChangeCommentThreads = this._onDidChangeCommentThreads.event;
  private activeThreads: WeakMap<vscode.CommentThread, string> = new WeakMap();
  private threadKeys: Map<string, vscode.CommentThread> = new Map();

  private getThreadKey(uri: vscode.Uri, line: number): string {
    return `${uri.toString()}:${line}`;
  }

  constructor() {
    // Create a comment controller
    this.commentController = vscode.comments.createCommentController('code-review-comments', 'Code Review Comments');

    // Set up commenting range provider
    this.commentController.commentingRangeProvider = {
      provideCommentingRanges: (document: vscode.TextDocument) => {
        const lineCount = document.lineCount;
        return [new vscode.Range(0, 0, lineCount, 0)];
      },
    };

    this.commentController.options = {
      prompt: 'Add a comment',
      placeHolder: 'Write a comment...',
    };
  }

  /**
   * Opens a file, goes to a specific line, and shows a comment box
   * @param filePath The full path to the file
   * @param lineNumber The line number (0-based) where to show the comment
   * @param commentText Optional initial text for the comment
   * @param promptText Optional custom text to show in the comment input
   */
  public async showCommentAtLine(
    filePath: string,
    lineNumber: number,
    commentText: string = '',
    promptText: string = '-Bug -Security -Performance',
  ): Promise<void> {
    try {
      const active_repo = getActiveRepo();
      const absolutePath = active_repo && path.join(active_repo, filePath);
      if (!absolutePath) {
        return;
      }

      // Convert to URI
      const uri = vscode.Uri.file(absolutePath);
      const threadKey = this.getThreadKey(uri, lineNumber);

      // Check if a comment thread already exists at this position
      const existingThread = this.threadKeys.get(threadKey);
      if (existingThread) {
        // If thread exists, just reveal it
        existingThread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
        return;
      }

      // Open the document
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      // Scroll to and select the line
      const position = new vscode.Position(lineNumber, 0);
      const range = new vscode.Range(position, position);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

      // Create a comment thread
      const commentThread = this.commentController.createCommentThread(uri, range, []);

      // Store the thread for future reference
      this.threadKeys.set(threadKey, commentThread);
      this.activeThreads.set(commentThread, threadKey);

      // Set comment thread properties
      commentThread.canReply = false;
      commentThread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      commentThread.label = promptText;

      // Add the initial comment if text is provided
      if (commentText) {
        const comment = new Comment(new vscode.MarkdownString(commentText), vscode.CommentMode.Preview, {
          name: 'DeputyDev',
        });
        commentThread.comments = [comment];
      }

      // When the thread is disposed, clean up our references
      const disposable = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === uri.toString()) {
          if (commentThread.comments.length === 0) {
            const key = this.activeThreads.get(commentThread);
            if (key) {
              this.threadKeys.delete(key);
              this.activeThreads.delete(commentThread);
              disposable.dispose();
            }
          }
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file and show comment: ${error}`);
      console.error(error);
    }
  }
}

// Simple Comment class implementation with markdown support
class Comment implements vscode.Comment {
  constructor(
    public body: string | vscode.MarkdownString,
    public mode: vscode.CommentMode,
    public author: { name: string },
    public contextValue?: string,
    public reactions?: vscode.CommentReaction[],
    public label?: string,
  ) {}
}
