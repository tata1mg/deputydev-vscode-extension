import * as vscode from 'vscode';
import { FileChangeStateManager } from './fileChangeStateManager/fileChangeStateManager';
import { DeputydevChangeProposer } from './viewers/deputydevChangeProposer/deputydevChangeProposer';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { binaryApi } from '../services/api/axios';
import { AuthService } from '../services/auth/AuthService';

export class DiffManager {
  private changeStateStorePath: string;
  private readonly vscodeContext: vscode.ExtensionContext;
  private readonly outputChannel: vscode.LogOutputChannel;
  private readonly authService: AuthService;

  private deputydevChangeProposer: DeputydevChangeProposer | undefined;
  private fileChangeStateManager: FileChangeStateManager | undefined;

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
    this.fileChangeStateManager = new FileChangeStateManager(this.vscodeContext, this.outputChannel);

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
    data: { path: string; incrementalUdiff: string },
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
    let newContent = originalContent;
    try {
      const authToken = await this.authService.loadAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
      };
      const response = await binaryApi().post(
        API_ENDPOINTS.DIFF_APPLIER,
        {
          diff_application_requests: [
            {
              file_path: data.path,
              repo_path: repoPath,
              current_content: originalContent,
              diff_data: { type: 'UDIFF', incremental_udiff: data.incrementalUdiff },
            },
          ],
        },
        { headers },
      );
      if (response.status !== 200) {
        throw new Error(`Error applying diff: ${response.statusText}`);
      }
      this.outputChannel.debug(`Diff apply call result from binary: ${JSON.stringify(response.data)}`);
      newContent = response.data['diff_application_results'][0]['new_content'];
    } catch (error) {
      this.outputChannel.error(`Error applying diff: ${error}`);
    }

    // return the new content
    return {
      originalContent,
      newContent: newContent || originalContent,
    };
  };

  public checkIsDiffApplicable = async (
    data: { path: string; incrementalUdiff: string },
    repoPath: string,
  ): Promise<boolean> => {
    this.outputChannel.debug(
      `Checking if diff is applicable for ${data.path} with repo path ${repoPath} and diff ${data.incrementalUdiff}`,
    );

    // get original and modified content after applying diff
    const { originalContent, newContent: modifiedContent } = await this.getOriginalAndModifiedContentAfterApplyingDiff(
      data,
      repoPath,
    );
    this.outputChannel.debug(`Original content: ${originalContent}`);
    this.outputChannel.debug(`Modified content: ${modifiedContent}`);

    // return true if the original content is different from the modified content
    return originalContent !== modifiedContent;
  };

  public openDiffView = async (filePath: string, repoPath: string, writeMode: boolean) => {
    if (!this.deputydevChangeProposer) {
      throw new Error('DiffManager not initialized');
    }
    await this.deputydevChangeProposer.openDiffView(filePath, repoPath, writeMode);
  };

  public applyDiff = async (
    data: { path: string; incrementalUdiff: string },
    repoPath: string,
    openViewer: boolean,
    applicationTrackingData: {
      usageTrackingSource: string;
      usageTrackingSessionId: number | null;
    },
    writeMode: boolean,
  ): Promise<boolean> => {
    this.checkInit();
    // first get the original and modified content after applying diff
    const { originalContent, newContent } = await this.getOriginalAndModifiedContentAfterApplyingDiff(data, repoPath);

    // update the fileChangeStateMap with the original and modified content from the udiff
    await (this.fileChangeStateManager as FileChangeStateManager).updateFileStateInFileChangeStateMapPostDiffApply(
      data.path,
      repoPath,
      newContent,
      data.path,
      writeMode,
      applicationTrackingData,
      originalContent,
    );

    if (openViewer) {
      // open the diff view
      await this.openDiffView(data.path, repoPath, writeMode);
    }

    return true;
  };

  public acceptAllFiles = async () => {};
  public rejectAllFiles = async () => {};
  public acceptFile = async (path: string) => {};
  public rejectFile = async (path: string) => {};
}
