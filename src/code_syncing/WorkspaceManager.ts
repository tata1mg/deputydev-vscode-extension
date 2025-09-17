// File: src/embedding/WorkspaceManager.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SidebarProvider } from '../panels/SidebarProvider';
import { WorkspaceFileWatcher } from './FileWatcher';
import { ConfigManager } from '../utilities/ConfigManager';
import { UpdateVectorStoreParams, IndexingService } from '../services/indexing/indexingService';
import { IndexingProgressData } from '../types';
import { getIsLspReady } from '../languageServer/lspStatus';

export class WorkspaceManager {
  private readonly workspaceRepos: Map<string, string> = new Map();
  private readonly context: vscode.ExtensionContext;
  private activeRepo: string | undefined; // Active repo stored as its folder path.
  private readonly sidebarProvider: SidebarProvider;
  private readonly outputChannel: vscode.LogOutputChannel;
  private fileWatchers?: Array<WorkspaceFileWatcher>;
  private readonly configManager: ConfigManager;
  private readonly activeRepoKey = 'activeRepo';
  private readonly _onDidSendRepos = new vscode.EventEmitter<{
    repos: { repoPath: string; repoName: string }[];
    activeRepo: string | null;
  }>();
  public readonly onDidSendRepos = this._onDidSendRepos.event;
  private readonly indexingService: IndexingService;

  constructor(
    context: vscode.ExtensionContext,
    sidebarProvider: SidebarProvider,
    outputChannel: vscode.LogOutputChannel,
    configManager: ConfigManager,
    indexingService: IndexingService,
  ) {
    this.context = context;
    this.sidebarProvider = sidebarProvider;
    this.outputChannel = outputChannel;
    this.configManager = configManager;
    this.indexingService = indexingService;

    // Subscribe to repo change events from SidebarProvider
    this.sidebarProvider.onDidChangeRepo((newRepoPath) => {
      this.outputChannel.info(`Received active repo change event: ${newRepoPath}`);
      this.setActiveRepo(newRepoPath);
      getIsLspReady({ force: true });
    });

    this.updateWorkspaceRepos();
    setTimeout(() => {
      this.updateWorkspaceRepos();
    }, 500);
    this.subscribeToWorkspaceFolderChanges();
    this.configManager.onDidUpdateConfig(() => {
      this.outputChannel.info('Config updated – reinitializing file watcher');
      this.initializeFileWatcher();
    });
  }

  /**
   * Updates the internal map of workspace repository paths and names,
   * then checks/updates the active repository and notifies the sidebar.
   */
  private updateWorkspaceRepos(): void {
    const folders = vscode.workspace.workspaceFolders;
    this.workspaceRepos.clear();
    if (folders && folders.length > 0) {
      folders.forEach((folder) => {
        const repoName = path.basename(folder.uri.fsPath);
        this.workspaceRepos.set(folder.uri.fsPath, repoName);
      });
    }

    // Update the active repo based on the current workspace repositories.
    this.updateActiveRepo();
  }

  /**
   * Validates the currently stored active repository.
   * If it's invalid or not set, defaults to the first available repo (if any),
   * and then persists the result in the workspace state.
   * Also initializes the file watcher accordingly.
   */
  private updateActiveRepo(): void {
    const storedActiveRepo = this.context.workspaceState.get<string>(this.activeRepoKey);
    this.outputChannel.info(`Stored active repo: ${storedActiveRepo}`);
    let newActiveRepo: string | undefined;

    if (this.workspaceRepos.size === 0) {
      // No repositories exist anymore, clear active repo.
      newActiveRepo = undefined;
      this.context.workspaceState.update(this.activeRepoKey, undefined);
      this.outputChannel.info(`No workspace repositories found.`);
    } else if (storedActiveRepo && this.workspaceRepos.has(storedActiveRepo)) {
      // Valid active repo exists; use it.
      newActiveRepo = storedActiveRepo;
    } else {
      // No valid active repo; default to the first repo if available.
      const firstRepoEntry = this.workspaceRepos.entries().next();
      if (!firstRepoEntry.done) {
        newActiveRepo = firstRepoEntry.value[0];
        this.context.workspaceState.update(this.activeRepoKey, newActiveRepo);
      } else {
        newActiveRepo = undefined;
        this.context.workspaceState.update(this.activeRepoKey, undefined);
      }
    }

    // Update active repo if it has changed.
    if (newActiveRepo !== this.activeRepo) {
      this.activeRepo = newActiveRepo;
      this.initializeFileWatcher();
      getIsLspReady({ force: true });
    }

    // this.outputChannel.info('Done with WebSockets.');

    // After updating active repo, inform the sidebar.
    this.sendReposToSidebar();
  }

  /**
   * Initializes or disposes the file watcher based on the active repo.
   * If active repo is defined, creates a new file watcher;
   * if not, disposes any existing watcher.
   */
  private initializeFileWatcher(): void {
    // Dispose any existing watcher.
    if (this.fileWatchers) {
      this.fileWatchers.forEach((watcher) => watcher.dispose());
      this.fileWatchers = undefined;
      this.outputChannel.info('Disposed existing file watcher.');
    }
    // If activeRepo is defined, create a new file watcher.
    if (this.activeRepo) {
      this.outputChannel.info(`Creating file watcher for active repo: ${this.activeRepo}`);

      // Create a new file watcher instance for each workspace repo.
      for (const [repoPath, _repoName] of this.workspaceRepos.entries()) {
        const watcher = new WorkspaceFileWatcher(
          repoPath,
          this.configManager,
          this.outputChannel,
          this.indexingService,
          this.sidebarProvider,
        );
        this.fileWatchers ??= [];
        this.fileWatchers.push(watcher);
      }
      this.outputChannel.info(`Initialized file watcher for active repo: ${this.activeRepo}`);
    } else {
      this.outputChannel.info('No active repository defined. File watcher not initialized.');
    }
  }

  /**
   * Sends a message to the sidebar with the current list of repositories and the active repo.
   */
  private sendReposToSidebar(): void {
    const reposArray = Array.from(this.workspaceRepos.entries()).map(([repoPath, repoName]) => ({
      repoPath,
      repoName,
    }));
    this.outputChannel.info(`Workspace repos: ${JSON.stringify(reposArray)}, active repo: ${this.activeRepo}`);
    this.sidebarProvider.sendMessageToSidebar({
      id: uuidv4(),
      command: 'set-workspace-repos',
      data: {
        repos: reposArray,
        activeRepo: this.activeRepo || null,
      },
    });
    this.outputChannel.info(
      `these are the repos stored in the workspace ${JSON.stringify(this.context.workspaceState.get('workspace-storage'))}`,
    );
    // Emit event for any listeners
    this._onDidSendRepos.fire({
      repos: reposArray,
      activeRepo: this.activeRepo || null,
    });
  }

  /**
   * Subscribes to workspace folder change events to dynamically update repo paths.
   */
  private subscribeToWorkspaceFolderChanges(): void {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.updateWorkspaceRepos();
      }),
    );
  }

  /**
   * Updates the active repository based on external input.
   * This method can be called from extension.ts when a message from the webview
   * indicates that the active repository has changed.
   */
  public setActiveRepo(newActiveRepo: string | undefined): void {
    if (!newActiveRepo) {
      this.outputChannel.info('Skipping WebSocket request: Active repo is undefined.');
      return; // ✅ Do NOT send WebSocket request if undefined
    }

    this.context.workspaceState.update(this.activeRepoKey, newActiveRepo);
    this.activeRepo = newActiveRepo;
    this.initializeFileWatcher();
    this.sendReposToSidebar();
    this.sendWebSocketUpdate(); // ✅ Send WebSocket request on valid repo change
    getIsLspReady({ force: true });
    this.outputChannel.info(`Active repo updated to: ${newActiveRepo}`);
  }

  /**
   * Sends WebSocket request with the active repo path.
   */
  private async sendWebSocketUpdate(): Promise<void> {
    if (!this.activeRepo) return; // ✅ Prevent sending undefined
    const indexingDataStorage = this.context.workspaceState.get('indexing-data-storage') as string;
    const parsedIndexingDataStorage = JSON.parse(indexingDataStorage);
    const indexingProgressData = parsedIndexingDataStorage?.state?.indexingProgressData as IndexingProgressData[];

    const repoSpecificIndexingProgress = indexingProgressData.find(
      (progress) => progress.repo_path === this.activeRepo,
    );
    if (repoSpecificIndexingProgress) {
      if (
        repoSpecificIndexingProgress.status === 'IN_PROGRESS' ||
        repoSpecificIndexingProgress.status === 'COMPLETED'
      ) {
        return;
      }
    }

    const params: UpdateVectorStoreParams = { repo_path: this.activeRepo };
    this.outputChannel.info(`📡 📡📡 Sending WebSocket update via workspace manager: ${JSON.stringify(params)}`);
    await this.indexingService
      .updateVectorStore(params)
      .then((response) => {})
      .catch((error) => {
        this.outputChannel.info('Embedding failed 3 times...');
      });
  }

  /**
   * Returns the current workspace repository paths and names.
   * If there are no repositories open, returns an empty map.
   */
  public getWorkspaceRepos(): Map<string, string> {
    return this.workspaceRepos;
  }
}
