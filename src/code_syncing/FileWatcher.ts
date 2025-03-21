// File: src/embedding/WorkspaceFileWatcher.ts

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';

import { updateVectorStore , UpdateVectorStoreParams } from '../clients/common/websocketHandlers';
import { ConfigManager } from '../utilities/ConfigManager';
export class WorkspaceFileWatcher {
  private watcher: vscode.FileSystemWatcher | undefined;
  private activeRepoPath: string;
  private ignoreMatcher: ReturnType<typeof ignore>;
  private configManager: ConfigManager;
  private outputChannel: vscode.LogOutputChannel;
  private pendingFileChanges: Set<string> = new Set();
  private changeTimeout: NodeJS.Timeout | null = null;
  /**
   * Constructs a new WorkspaceFileWatcher.
   * @param activeRepoPath The current active repository path.
   * @param configManager The configuration manager instance.
   * @param outputChannel The log output channel for logging.
   */
  constructor(
    activeRepoPath: string,
    configManager: ConfigManager,
    outputChannel: vscode.LogOutputChannel
  ) {
    this.activeRepoPath = activeRepoPath;
    this.configManager = configManager;
    this.outputChannel = outputChannel;
    this.ignoreMatcher = ignore();

    // Load ignore patterns from .gitignore files and configuration.
    this.loadIgnorePatterns();

    // Create a file watcher for all files under the active repository.
    const pattern = new vscode.RelativePattern(this.activeRepoPath, '**/*');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Subscribe to file system events.
    this.watcher.onDidCreate(uri => this.scheduleFileUpdate(uri));
    this.watcher.onDidChange(uri => this.scheduleFileUpdate(uri));
    this.watcher.onDidDelete(uri => this.scheduleFileUpdate(uri));
  }

  /**
   * Loads ignore patterns from:
   *   1. All .gitignore files (recursively) in the active repo,
   *   2. Additional ignore patterns from the config,
   *   3. Exclude directories and file extensions from the config.
   */
  private loadIgnorePatterns(): void {
    let patterns: string[] = [];
    const config = this.configManager.getConfig();
    // Load patterns from .gitignore files recursively.
    patterns = patterns.concat(this.loadGitignorePatternsRecursive(this.activeRepoPath, ''));
    patterns.push('.git/');  // Ignore the entire .git directory

    // Ignore all files with .git extension but NOT .gitignore or .gitattributes
    patterns.push('**/*.git');
    // Additional ignore patterns from configuration.
    const additionalIgnore: string[] = config["EXLUDE_PATTERN"] || [];
    patterns = patterns.concat(additionalIgnore);

    // Exclude directories from configuration.
    const excludeDirs: string[] = config["EXCLUDE_DIRS"] || [];
    const dirPatterns = excludeDirs.map(dir => `${dir.replace(/\\/g, '/')}/**`);
    patterns = patterns.concat(dirPatterns);

    // Exclude file extensions or specific filenames from configuration.
    const excludeExts: string[] = config["EXCLUDE_EXTS"]  || [];
    const extPatterns = excludeExts.map(ext => {
      // If it starts with a dot, assume it's an extension.
      return ext.startsWith('.') ? `**/*${ext}` : `**/${ext}`;
    });
    patterns = patterns.concat(extPatterns);

    // Add all gathered patterns to the ignore matcher.
    this.ignoreMatcher.add(patterns);
    // print all config called values
    this.outputChannel.info(`Additional ignore patterns loaded: ${additionalIgnore.join(', ')}`);
    this.outputChannel.info(`Exclude directories loaded: ${excludeDirs.join(', ')}`);
    this.outputChannel.info(`Exclude extensions loaded: ${excludeExts.join(', ')}`);
    this.outputChannel.info(`Ignore patterns loaded: ${patterns.join(', ')}`);
  }

  /**
   * Recursively loads patterns from all .gitignore files under a given directory.
   *
   * @param dir The directory to search.
   * @param base The relative base path from the active repository root.
   * @returns An array of ignore patterns adjusted relative to the active repo.
   */
  private loadGitignorePatternsRecursive(dir: string, base: string): string[] {
    let patterns: string[] = [];
    const gitignorePath = path.join(dir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        const filePatterns = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        const adjusted = filePatterns.map(pattern => {
          // Remove leading '/' (indicating repo-root relative) and adjust with base if needed.
          if (pattern.startsWith('/')) {
            pattern = pattern.substring(1);
          }
          return base ? path.join(base, pattern).replace(/\\/g, '/') : pattern;
        });
        patterns = patterns.concat(adjusted);
      } catch (error) {
        this.outputChannel.error(`Error reading ${gitignorePath}: ${error}`);
      }
    }

    // Recurse into subdirectories (skip the .git folder).
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '.git') {
          const subDir = path.join(dir, entry.name);
          const subBase = base ? path.join(base, entry.name) : entry.name;
          patterns = patterns.concat(this.loadGitignorePatternsRecursive(subDir, subBase));
        }
      }
    } catch (error) {
      this.outputChannel.error(`Error reading directory ${dir}: ${error}`);
    }
    return patterns;
  }

  /**
   * Determines whether a given file URI should be ignored.
   * @param uri The file URI.
   * @returns True if the file should be ignored, false otherwise.
   */
  private shouldIgnore(uri: vscode.Uri): boolean {
    const relativePath = path.relative(this.activeRepoPath, uri.fsPath).replace(/\\/g, '/');
    return this.ignoreMatcher.ignores(relativePath);
  }

  private scheduleFileUpdate(uri: vscode.Uri): void {
    if (this.shouldIgnore(uri)) {
      return;
    }
  
    const relativePath = path.relative(this.activeRepoPath, uri.fsPath).replace(/\\/g, '/');
    this.pendingFileChanges.add(relativePath);
  
    if (this.changeTimeout) {
      clearTimeout(this.changeTimeout);
    }
  
    this.changeTimeout = setTimeout(() => {
      this.processFileUpdates();
      this.changeTimeout = null;
    }, 500);
  }
  




  /**
   * Processes all collected file changes after a delay.
   */
  private processFileUpdates(): void {
    if (this.pendingFileChanges.size > 0) {
      const fileListArray = Array.from(this.pendingFileChanges);
      const fileList = fileListArray.join(', '); // Convert to string
      // Construct request payload
      const params: UpdateVectorStoreParams = {
        repo_path: this.activeRepoPath, // Send active repository path
        chunkable_files: fileListArray,  // Send updated file list
      };
      this.outputChannel.info(`Sending update to WebSocket: ${JSON.stringify(params)}`);
      
      // Send update to WebSocket in fire-and-forget mode (no waiting for a response)
      updateVectorStore(params);
  
      this.outputChannel.info(`Files updated with websockets: ${fileList}`);
      this.pendingFileChanges.clear();
    }
  }
  


  /**
   * Disposes the file watcher.
   */
  public dispose(): void {
    if (this.watcher) {
      this.watcher.dispose();
    }
  }
}
