import * as vscode from 'vscode';
import * as path from 'path';
import { getActiveRepo } from '../utilities/contextManager';

export class CommentHandler {
  private extensionPath: string;
  private commentController: vscode.CommentController;
  private _onDidChangeCommentThreads = new vscode.EventEmitter<vscode.CommentThread>();
  public onDidChangeCommentThreads = this._onDidChangeCommentThreads.event;
  private activeThreads: WeakMap<vscode.CommentThread, string> = new WeakMap();
  private threadKeys: Map<string, vscode.CommentThread> = new Map();
  private commentIds: Map<string, number> = new Map();
  private activeThread: vscode.CommentThread | null = null;

  private getThreadKey(uri: vscode.Uri, line: number): string {
    return `${uri.toString()}:${line}`;
  }

  constructor(context: vscode.ExtensionContext) {
    this.extensionPath = context.extensionPath;
    // Create a comment controller
    this.commentController = vscode.comments.createCommentController('DeputyDevCodeReview', 'DeputyDev Code Review');

    // Set up commenting range provider
    this.commentController.commentingRangeProvider = {
      provideCommentingRanges: (document: vscode.TextDocument) => {
        const lineCount = document.lineCount;
        return [new vscode.Range(0, 0, lineCount, 0)];
      },
    };
  }
  public closeThread(thread: vscode.CommentThread): void {
    const threadKey = this.activeThreads.get(thread);
    if (threadKey) {
      this.threadKeys.delete(threadKey);
      this.activeThreads.delete(thread);
    }
    thread.dispose();
    if (this.activeThread === thread) {
      this.activeThread = null;
    }
  }

  /**
   * Closes and cleans up all comment threads
   */
  public closeAllThreads(): void {
    // Get all active threads from threadKeys map
    const allThreads = Array.from(this.threadKeys.values());

    // Process each thread
    allThreads.forEach((thread) => {
      try {
        // Remove from activeThreads map
        const threadKey = this.activeThreads.get(thread);
        if (threadKey) {
          this.threadKeys.delete(threadKey);
          this.commentIds.delete(threadKey);
        }

        // Dispose the thread
        thread.dispose();
      } catch (error) {
        console.error('Error closing thread:', error);
      }
    });

    // Clear all maps
    this.threadKeys.clear();
    this.activeThreads = new WeakMap();
    this.commentIds.clear();
    this.activeThread = null;
  }

  /**
   * Opens a file, goes to a specific line, and shows a comment box
   * @param filePath The full path to the file
   * @param lineNumber The line number (0-based) where to show the comment
   * @param commentText Optional initial text for the comment
   * @param promptText Optional custom text to show in the comment input
   * @param commentId Optional comment ID
   */
  public async showCommentAtLine(
    filePath: string,
    lineNumber: number,
    commentText: string,
    promptText: string,
    commentId?: number,
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
        // Close the existing thread before opening a new one
        this.closeThread(existingThread);
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
      this.activeThread = commentThread;

      // Store the thread for future reference
      this.threadKeys.set(threadKey, commentThread);
      this.activeThreads.set(commentThread, threadKey);

      // Set comment thread properties
      commentThread.canReply = false;
      commentThread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      commentThread.label = promptText;
      commentThread.contextValue = 'editable';

      // Add the initial comment if text is provided
      if (commentText) {
        const comment = new Comment(new vscode.MarkdownString(commentText), vscode.CommentMode.Preview, {
          name: 'DeputyDev',
          iconPath: vscode.Uri.file(path.join(this.extensionPath, 'assets', 'dd_logo_light.png')),
        });
        commentThread.comments = [comment];
      }

      // Store the comment ID
      if (commentId !== undefined) {
        this.commentIds.set(threadKey, commentId);
      }

      // When the thread is disposed, clean up our references
      const disposable = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === uri.toString()) {
          if (commentThread.comments.length === 0) {
            const key = this.activeThreads.get(commentThread);
            if (key) {
              this.threadKeys.delete(key);
              this.activeThreads.delete(commentThread);
              this.commentIds.delete(key);
              if (this.activeThread === commentThread) {
                this.activeThread = null;
              }
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

  /**
   * Gets the comment ID for a specific thread
   * @param uri The URI of the document
   * @param lineNumber The line number of the comment
   * @returns The comment ID if it exists, undefined otherwise
   */
  public getCommentId(uri: vscode.Uri, lineNumber: number): number | undefined {
    const threadKey = this.getThreadKey(uri, lineNumber);
    return this.commentIds.get(threadKey);
  }

  /**
   * Gets the comment ID for a specific thread using the thread itself
   * @param thread The comment thread
   * @returns The comment ID if it exists, undefined otherwise
   */
  public getCommentIdFromThread(thread: vscode.CommentThread): number | undefined {
    const threadKey = this.activeThreads.get(thread);
    return threadKey ? this.commentIds.get(threadKey) : undefined;
  }
}

// Simple Comment class implementation with markdown support
class Comment implements vscode.Comment {
  constructor(
    public body: string | vscode.MarkdownString,
    public mode: vscode.CommentMode,
    public author: vscode.CommentAuthorInformation,
    public contextValue?: string,
    public reactions?: vscode.CommentReaction[],
    public label?: string,
  ) {}
}
