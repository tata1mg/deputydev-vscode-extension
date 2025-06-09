import * as vscode from 'vscode';
import { FileChangeStateManager } from './fileChangeStateManager/fileChangeStateManager';
import { DeputydevChangeProposer } from './viewers/deputydevChangeProposer/deputydevChangeProposer';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { binaryApi } from '../services/api/axios';
import { AuthService } from '../services/auth/AuthService';

export class DiffManager {
  private readonly changeStateStorePath: string;
  private readonly vscodeContext: vscode.ExtensionContext;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly authService: AuthService;

  private deputydevChangeProposer: DeputydevChangeProposer | undefined;
  private fileChangeStateManager: FileChangeStateManager | undefined;
  private readonly sessionIdToFilePathAndRepoPathMap: Map<number, Array<{ filePath: string; repoPath: string }>>;

  constructor(
    vscodeContext: vscode.ExtensionContext,
    changeStateStorePath: string,
    outputChannel: vscode.LogOutputChannel,
    authService: AuthService,
  ) {
    this.changeStateStorePath = changeStateStorePath;
    this.vscodeContext = vscodeContext;
    this.outputChannel = outputChannel;
    this.authService = authService;

    this.sessionIdToFilePathAndRepoPathMap = new Map<number, Array<{ filePath: string; repoPath: string }>>();

    // If you want commands for accepting or rejecting ALL tracked files:
    this.vscodeContext.subscriptions.push(
      vscode.commands.registerCommand('deputydev.acceptAllChanges', async () => {
        outputChannel.info(`Accepting changes for all file`);
        await this.acceptAllFiles();
        vscode.window.showInformationMessage('All changes accepted.');
      }),
    );
    this.vscodeContext.subscriptions.push(
      vscode.commands.registerCommand('deputydev.rejectAllChanges', async () => {
        await this.rejectAllFiles();
        vscode.window.showInformationMessage('All changes rejected.');
      }),
    );
  }

  // initialize the diff manager
  public init = async () => {
    this.fileChangeStateManager = new FileChangeStateManager(
      this.vscodeContext,
      this.outputChannel,
      this.changeStateStorePath,
    );

    this.deputydevChangeProposer = new DeputydevChangeProposer(
      this.vscodeContext,
      this.outputChannel,
      this.fileChangeStateManager,
    );
    await this.deputydevChangeProposer.init();
  };

  private checkInit = () => {
    if (!this.deputydevChangeProposer) {
      throw new Error('DeputydevChangeProposer not initialized');
    }
    if (!this.fileChangeStateManager) {
      throw new Error('FileChangeStateManager not initialized');
    }
  };

  private getOriginalAndModifiedContentAfterApplyingDiff = async (
    data: { path: string; search_and_replace_blocks?: string; incrementalUdiff?: string },
    repoPath: string,
  ): Promise<{
    originalContent: string;
    newContent: string;
  }> => {
    this.checkInit();
    // first get the current content of the file to apply the diff on
    const originalContent = await (
      this.fileChangeStateManager as FileChangeStateManager
    ).getCurrentContentOnWhichChangesAreToBeApplied(data.path, repoPath);
    // then apply the diff to the original content
    // Prepare the diff_data and type based on what's provided
    let diffData;
    if (data.search_and_replace_blocks) {
      diffData = {
        type: 'SEARCH_AND_REPLACE',
        search_and_replace_blocks: data.search_and_replace_blocks,
      };
    } else {
      diffData = {
        type: 'UDIFF',
        incremental_udiff: data.incrementalUdiff,
      };
    }
    let newContent = originalContent;
    try {
      const payload = {
        diff_application_requests: [
          {
            file_path: data.path,
            repo_path: repoPath,
            current_content: originalContent,
            diff_data: diffData,
          },
        ],
      };
      const response = await binaryApi().post(API_ENDPOINTS.DIFF_APPLIER, payload);

      this.outputChannel.debug(`Diff apply call result DEBUG: ${JSON.stringify(response.data)}`); // todo: remove this
      if (response.status !== 200) {
        throw new Error(`Error applying changes: ${response.statusText}`);
      }
      this.outputChannel.debug(`Diff apply call result from binary: ${JSON.stringify(response.data)}`);
      newContent = response.data['diff_application_results'][0]['new_content'];
    } catch (error: any) {
      if (error.response && error.response.data) {
        const serverError = error.response.data.error || JSON.stringify(error.response.data);
        this.outputChannel.error(`Error applying changes: ${serverError}`);
        throw new Error(`${serverError}`);
      } else {
        this.outputChannel.error(`Error applying changes: ${error}`);
        throw new Error(`Failed to apply changes:\n${(error as Error).message}`);
      }
    }

    // return the new content
    return {
      originalContent,
      newContent: newContent || originalContent,
    };
  };
  public checkIsDiffApplicable = async (
    data: { path: string; search_and_replace_blocks?: string; incrementalUdiff?: string },
    repoPath: string,
  ): Promise<{ diffApplySuccess: boolean; addedLines: number; removedLines: number }> => {
    this.outputChannel.debug(`Checking if diff is applicable for ${data.path} with repo path ${repoPath}`);

    this.checkInit();

    const { originalContent, newContent: modifiedContent } = await this.getOriginalAndModifiedContentAfterApplyingDiff(
      data,
      repoPath,
    );

    this.outputChannel.debug(`Original content: ${originalContent}`);
    this.outputChannel.debug(`Modified content: ${modifiedContent}`);

    // If there's no difference, diff is not applicable
    if (originalContent === modifiedContent) {
      this.outputChannel.info(`Diff is not applicable for ${data.path}`);
      return {
        diffApplySuccess: false,
        addedLines: 0,
        removedLines: 0,
      };
    }

    // Diff is applicable, compute line changes
    const { addedLines, removedLines } = await this.fileChangeStateManager!.computeDiffLineChanges(
      data.path,
      repoPath,
      modifiedContent,
      data.path,
    );

    this.outputChannel.info(
      `Diff is applicable for ${data.path} with ${addedLines} added lines and ${removedLines} removed lines`,
    );

    return {
      diffApplySuccess: true,
      addedLines,
      removedLines,
    };
  };

  public openDiffView = async (filePath: string, repoPath: string, writeMode: boolean) => {
    if (!this.deputydevChangeProposer) {
      throw new Error('DiffManager not initialized');
    }
    await this.deputydevChangeProposer.openDiffView(filePath, repoPath, writeMode);
  };

  public applyDiff = async (
    data: { path: string; search_and_replace_blocks?: string; incrementalUdiff?: string },
    repoPath: string,
    openViewer: boolean,
    applicationTrackingData: {
      usageTrackingSource: string;
      usageTrackingSessionId: number | null;
    },
    writeMode: boolean,
  ): Promise<{ diffApplySuccess: boolean; addedLines: number; removedLines: number }> => {
    this.checkInit();
    try {
      // Get the original and modified content after applying the diff
      const { originalContent, newContent } = await this.getOriginalAndModifiedContentAfterApplyingDiff(data, repoPath);
      if (originalContent === newContent && originalContent != '') {
        this.outputChannel.info(`Diff is not applicable for ${data.path}`);
        return { diffApplySuccess: false, addedLines: 0, removedLines: 0 };
      }
      // update the fileChangeStateMap with the original and modified content from the udiff
      const {
        addedLines,
        removedLines,
        originalContent: updatedOriginalContent,
        modifiedContent: updatedModifiedContent,
      } = await this.fileChangeStateManager!.updateFileStateInFileChangeStateMapPostDiffApply(
        data.path,
        repoPath,
        newContent,
        data.path,
        writeMode,
        applicationTrackingData,
        originalContent,
      );

      // Optionally open the diff viewer
      if (openViewer) {
        await this.openDiffView(data.path, repoPath, writeMode);
      }

      return {
        diffApplySuccess: true,
        addedLines,
        removedLines,
      };
    } catch (error) {
      this.outputChannel.error(`applyDiff failed:\n${(error as Error).message}`);
      throw error; // Optional: return false if you want to silently fail
    }
  };

  public applyDiffForSession = async (
    data: { path: string; search_and_replace_blocks?: string; incrementalUdiff?: string },
    repoPath: string,
    applicationTrackingData: {
      usageTrackingSource: string;
      usageTrackingSessionId: number | null;
    },
    writeMode: boolean,
    sessionId: number,
  ): Promise<{ diffApplySuccess: boolean; addedLines: number; removedLines: number }> => {
    const firstTimeApplyingSessionFile = false;
    // first add the filePath and repoPath to the sessionIdToFilePathAndRepoPathMap
    if (!this.sessionIdToFilePathAndRepoPathMap.has(sessionId)) {
      this.sessionIdToFilePathAndRepoPathMap.set(sessionId, [{ filePath: data.path, repoPath: repoPath }]);
    } else {
      const existingFiles = this.sessionIdToFilePathAndRepoPathMap.get(sessionId);
      if (existingFiles) {
        // Only add if this filePath/repoPath pair is not already present
        const alreadyExists = existingFiles.some(
          (entry) => entry.filePath === data.path && entry.repoPath === repoPath,
        );
        if (!alreadyExists) {
          existingFiles.push({ filePath: data.path, repoPath: repoPath });
          this.sessionIdToFilePathAndRepoPathMap.set(sessionId, existingFiles);
        }
      }
    }

    // Now apply the diff and return the result
    // openViweer will be true only if the session file is first time being applied

    return this.applyDiff(data, repoPath, firstTimeApplyingSessionFile, applicationTrackingData, writeMode);
  };

  private async getLatestFilesWithChangesForSession(
    sessionId: number,
  ): Promise<Array<{ filePath: string; repoPath: string }>> {
    // Get the filePath and repoPath pairs for the sessionId which are currently in the fileChangeStateMap
    const filePathAndRepoPathArray = this.sessionIdToFilePathAndRepoPathMap.get(sessionId);
    if (!filePathAndRepoPathArray || filePathAndRepoPathArray.length === 0) {
      this.outputChannel.info(`No files to accept for session ${sessionId}`);
      return [];
    }

    // check initialization
    this.checkInit();

    // filter the filePathAndRepoPathArray to only include files that are tracked in the fileChangeStateMap
    const trackedFiles: Array<{ filePath: string; repoPath: string }> = [];
    for (const { filePath, repoPath } of filePathAndRepoPathArray) {
      const trackedFileChangeState = await (this.fileChangeStateManager as FileChangeStateManager).getFileChangeState(
        filePath,
        repoPath,
      );
      if (trackedFileChangeState) {
        trackedFiles.push({ filePath, repoPath });
      }
    }
    return trackedFiles;
  }

  public acceptAllFilesForSession = async (
    sessionId: number,
  ) => {
    // get all the files that are tracked in the fileChangeStateMap for the sessionId
    const filePathAndRepoPathArray = await this.getLatestFilesWithChangesForSession(sessionId);

    // parallely accept all the files
    const acceptPromises = filePathAndRepoPathArray.map(async ({ filePath, repoPath }) => {
      try {
        await (this.fileChangeStateManager as FileChangeStateManager).acceptAllChangesInFile(filePath, repoPath);
        this.outputChannel.info(`Accepted changes for file: ${filePath}`);
      } catch (error) {
        this.outputChannel.error(`Failed to accept changes for file ${filePath}: ${(error as Error).message}`);
      }
    });
    try {
      await Promise.all(acceptPromises);
      this.outputChannel.info(`All changes accepted for session ${sessionId}`);
    } catch (error) {
      this.outputChannel.error(`Failed to accept all changes for session ${sessionId}: ${(error as Error).message}`);
    }
  };

  public rejectAllFilesForSession = async (
    sessionId: number,
  ) => {
    // get all the files that are tracked in the fileChangeStateMap for the sessionId
    const filePathAndRepoPathArray = await this.getLatestFilesWithChangesForSession(sessionId);

    // parallely reject all the files
    const rejectPromises = filePathAndRepoPathArray.map(async ({ filePath, repoPath }) => {
      try {
        await (this.fileChangeStateManager as FileChangeStateManager).rejectAllChangesInFile(filePath, repoPath);
        this.outputChannel.info(`Rejected changes for file: ${filePath}`);
      } catch (error) {
        this.outputChannel.error(`Failed to reject changes for file ${filePath}: ${(error as Error).message}`);
      }
    });
    try {
      await Promise.all(rejectPromises);
      this.outputChannel.info(`All changes rejected for session ${sessionId}`);
    } catch (error) {
      this.outputChannel.error(`Failed to reject all changes for session ${sessionId}: ${(error as Error).message}`);
    }
  };

  public acceptFile = async (filePath: string, repoPath: string) => {
    this.checkInit();
    try {
      await (this.fileChangeStateManager as FileChangeStateManager).acceptAllChangesInFile(filePath, repoPath);
    } catch (error) {
      this.outputChannel.error(`acceptFile failed:\n${(error as Error).message}`);
      throw error;
    }
  };

  public rejectFile = async (filePath: string, repoPath: string) => {
    this.checkInit();
    try {
      await (this.fileChangeStateManager as FileChangeStateManager).rejectAllChangesInFile(filePath, repoPath);
    } catch (error) {
      this.outputChannel.error(`rejectFile failed:\n${(error as Error).message}`);
      throw error;
    }
  };
}
