import * as vscode from "vscode";
import { FileChangeStateManager } from "./fileChangeStateManager/fileChangeStateManager";
import { DeputydevChangeProposer } from "./viewers/deputydevChangeProposer/deputydevChangeProposer";
import { API_ENDPOINTS } from "../services/api/endpoints";
import { binaryApi } from "../services/api/axios";


export class DiffManager {
  private changeStateStorePath: string;
  private vscodeContext: vscode.ExtensionContext;
  private outputChannel: vscode.LogOutputChannel;

  private deputydevChangeProposer: DeputydevChangeProposer | undefined;
  private fileChangeStateManager: FileChangeStateManager | undefined;

  constructor(vscodeContext: vscode.ExtensionContext, changeStateStorePath: string, outputChannel: vscode.LogOutputChannel) {
    this.changeStateStorePath = changeStateStorePath;
    this.vscodeContext = vscodeContext;
    this.outputChannel = outputChannel;
  }

  // initialize the diff manager
  public init = async () => {
    this.fileChangeStateManager = new FileChangeStateManager(
      this.vscodeContext,
      this.outputChannel,
    );

    this.deputydevChangeProposer = new DeputydevChangeProposer(
      this.vscodeContext,
      this.outputChannel,
      this.fileChangeStateManager,
    );
    await this.deputydevChangeProposer.init();
  }

  private checkInit = () => {
    if (!this.deputydevChangeProposer) {
      throw new Error("DeputydevChangeProposer not initialized");
    }
    if (!this.fileChangeStateManager) {
      throw new Error("FileChangeStateManager not initialized");
    }
  }

  public applyDiff = async (data: { path: string; incrementalUdiff: string }, repoPath: string) => {
    this.checkInit();
    // first get the current content of the file to apply the diff on
    const originalContent = await this.fileChangeStateManager.getOriginalContentToShowDiffOn(
      data.path
    );

    // then apply the diff to the original content
    let newContent = originalContent;
    try {
      const response = await binaryApi().post(API_ENDPOINTS.DIFF_APPLIER, {
        repo_path: repoPath,
        file_path_to_diff_map: {
          [data.path]: data.incrementalUdiff,
        },
      }, { headers });
      if (response.status !== 200) {
        throw new Error(`Error applying diff: ${response.statusText}`);
      }
      newContent = response.data.file_path_to_diff_map[data.path];
    } catch (error) {
      this.outputChannel.error(`Error applying diff: ${error}`);
      throw error;
    }

    // update the fileChangeStateMap with the original and modified content from the udiff
    this.fileChangeStateManager?.updateFileStateInFileChangeStateMap(
      data.path,
      newContent,
      originalContent
    );

  }


  public openDiffView = async (data: { path: string; content: string }) => {
    if (!this.deputydevChangeProposer) {
      throw new Error("DiffManager not initialized");
    }
    await this.deputydevChangeProposer.openDiffView(data);
  }
  public acceptAllFiles = async () => { }
  public rejectAllFiles = async () => { }
}
