import * as vscode from 'vscode';
import * as path from 'path';
import { SidebarProvider } from '../panels/SidebarProvider';
import { v4 as uuidv4 } from 'uuid';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { getActiveRepo, getRepositoriesForContext } from '../utilities/contextManager';
import { WorkspaceManager } from './WorkspaceManager';

/** ms */
const ACTIVE_EDITOR_DEBOUNCE = 50;
const SELECTION_EVENT_DEBOUNCE = 200; // ← #3

export class ActiveFileListener implements vscode.Disposable {
  private readonly sideBarProvider: SidebarProvider;
  private readonly logger = SingletonLogger.getInstance();
  private readonly workspaceManager: WorkspaceManager;

  private readonly disposables: vscode.Disposable[] = [];
  private activeEditorTimeout: NodeJS.Timeout | null = null;
  private selectionTimeout: NodeJS.Timeout | null = null;

  /** Remember the last file path we emitted so we can “clear”
   *  selections when the user focuses the Output / Problems pane, etc. (#2) */
  private lastRelativePath: string | undefined;
  private lastStartLine: number | undefined;
  private lastEndLine: number | undefined;

  /** Keep the most-recent real editor around for repo-ready callback. */
  private latestEditor: vscode.TextEditor | undefined;

  constructor(sideBarProvider: SidebarProvider, workspaceManager: WorkspaceManager) {
    this.sideBarProvider = sideBarProvider;
    this.workspaceManager = workspaceManager;

    /* --------------- repos arrive late --------------- */
    this.workspaceManager.onDidSendRepos(() => {
      this.sendActiveFile(this.latestEditor);
    });

    this.sideBarProvider.onDidChangeContextRepos(() => {
      this.sendActiveFile(this.latestEditor);
    });

    /* --------------- initial state --------------- */
    this.latestEditor = vscode.window.activeTextEditor;
    this.sendActiveFile(this.latestEditor);

    /* --------------- active-editor changes --------------- */
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (this.activeEditorTimeout) clearTimeout(this.activeEditorTimeout);
        this.latestEditor = editor; // may be undefined

        this.activeEditorTimeout = setTimeout(() => {
          this.sendActiveFile(this.latestEditor); // always clears selection if needed
          this.activeEditorTimeout = null;
        }, ACTIVE_EDITOR_DEBOUNCE);
      }),
    );

    /* --------------- selection changes --------------- */
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (this.selectionTimeout) clearTimeout(this.selectionTimeout);

        this.selectionTimeout = setTimeout(() => {
          // 150 ms debounce so we don’t spam while dragging  (#3)
          const sel = e.selections?.[0];
          this.sendActiveFile(e.textEditor, sel);
          this.selectionTimeout = null;
        }, SELECTION_EVENT_DEBOUNCE);
      }),
    );
  }

  /**
   * Core emitter.
   * - Adds +1 to line numbers so they are **1-indexed** (#1)
   * - If the given editor is undefined **or** not a real file, we still
   *   send `{fileUri}` for the *previous* file to clear any selection (#2)
   */
  private async sendActiveFile(editor: vscode.TextEditor | undefined, selection?: vscode.Selection) {
    const activeEditor = vscode.window.activeTextEditor;

    const allowedSchemes = ['file', 'vscode-userdata', 'vscode-settings', 'walkThrough'];
    if (activeEditor && allowedSchemes.includes(activeEditor.document.uri.scheme)) {
      const fileUri = activeEditor.document.uri;
      const filePath = fileUri.fsPath;
      const ext = path.extname(filePath).toLowerCase();

      // List of image or unsupported extensions (can be extended)
      const unsupportedExtensions = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.bmp',
        '.webp',
        '.ico',
        '.svg',
        '.mp4',
        '.mp3',
        '.avi',
        '.pdf',
      ];

      // Skip sending relPath for unsupported file types
      const isUnsupported = unsupportedExtensions.includes(ext);

      const contextRepositories = getRepositoriesForContext();

      const activeRepo = getActiveRepo();
      let absPath: string | undefined;

      if (
        !isUnsupported &&
        activeRepo &&
        (contextRepositories?.some((repo) => filePath.startsWith(repo.repoPath)) || filePath.startsWith(activeRepo))
      ) {
        absPath = filePath;
      }

      const payload: { fileUri?: string; startLine?: number; endLine?: number } = {
        fileUri: absPath, // will be undefined for unsupported files
      };

      if (selection && !selection.isEmpty && !isUnsupported) {
        payload.startLine = selection.start.line + 1;
        payload.endLine = selection.end.line + 1;
      }

      this.lastRelativePath = absPath;
      this.lastStartLine = payload.startLine;
      this.lastEndLine = payload.endLine;

      this.publish(payload);
      return;
    }

    // Uncomment this block if you want to emit the previous file when focus is lost:
    if (this.lastRelativePath) {
      this.publish({ fileUri: undefined });
    }
  }

  private publish(payload: { fileUri?: string; startLine?: number; endLine?: number }) {
    // this.logger.debug('Active file change:', payload);
    this.sideBarProvider.sendMessageToSidebar({
      id: uuidv4(),
      command: 'active-file-change',
      data: payload,
    });
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    if (this.activeEditorTimeout) clearTimeout(this.activeEditorTimeout);
    if (this.selectionTimeout) clearTimeout(this.selectionTimeout);
  }
}
