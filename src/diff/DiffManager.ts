import * as vscode from "vscode";
import { FileChangeStateManager } from "./fileChangeStateManager/fileChangeStateManager";
import { DeputydevChangeProposer } from "./viewers/deputydevChangeProposer/deputydevChangeProposer";
import { API_ENDPOINTS } from "../services/api/endpoints";
import { binaryApi } from "../services/api/axios";
import { AuthService } from "../services/auth/AuthService";


export class DiffManager {
  private changeStateStorePath: string;
  private vscodeContext: vscode.ExtensionContext;
  private outputChannel: vscode.LogOutputChannel;
  private authService: AuthService;

  private deputydevChangeProposer: DeputydevChangeProposer | undefined;
  private fileChangeStateManager: FileChangeStateManager | undefined;

  constructor(vscodeContext: vscode.ExtensionContext, changeStateStorePath: string, outputChannel: vscode.LogOutputChannel, authService: AuthService) {
    this.changeStateStorePath = changeStateStorePath;
    this.vscodeContext = vscodeContext;
    this.outputChannel = outputChannel;
    this.authService = authService;

      // 7) Register commands for Accept/Reject etc
      //
      // Accept changes in the active file
      // this.vscodeContext.subscriptions.push(
      //   vscode.commands.registerCommand("deputydev.acceptChanges", async () => {
      //     const editor = vscode.window.activeTextEditor;
      //     if (!editor) {
      //       vscode.window.showErrorMessage(
      //         "No active editor to accept changes for."
      //       );
      //       return;
      //     }
      //     const fileUri = editor.document.uri;
      //     outputChannel.info(`Accepting changes for ${fileUri.fsPath}`);
      //     await diffViewManager.acceptFile(fileUri.fsPath);
      //     vscode.window.showInformationMessage("Changes accepted successfully.");
      //   })
      // );
    
      // // Reject changes in the active file
      // this.vscodeContext.subscriptions.push(
      //   vscode.commands.registerCommand("deputydev.rejectChanges", async () => {
      //     const editor = vscode.window.activeTextEditor;
      //     if (!editor) {
      //       vscode.window.showErrorMessage(
      //         "No active editor to reject changes for."
      //       );
      //       return;
      //     }
      //     const fileUri = editor.document.uri;
      //     outputChannel.info(`rejecting changes for ${fileUri.fsPath}`);
      //     await diffViewManager.rejectFile(fileUri.fsPath);
      //     vscode.window.showInformationMessage("Changes rejected successfully.");
      //   })
      // );
    
      // If you want commands for accepting or rejecting ALL tracked files:
      this.vscodeContext.subscriptions.push(
        vscode.commands.registerCommand("deputydev.acceptAllChanges", async () => {
          outputChannel.info(`Accepting changes for all file`);
          await this.acceptAllFiles();
          vscode.window.showInformationMessage("All changes accepted.");
        })
      );
      this.vscodeContext.subscriptions.push(
        vscode.commands.registerCommand("deputydev.rejectAllChanges", async () => {
          await this.rejectAllFiles();
          vscode.window.showInformationMessage("All changes rejected.");
        })
      );

        // Command to open a diff view for any file path + new content
        this.vscodeContext.subscriptions.push(
          vscode.commands.registerCommand(
            "deputydev.openDiffView",
            async (path: string, content: string) => {
              try {
                await this.openDiffView(path);
                vscode.window.showInformationMessage(`Diff view opened for ${path}`);
              } catch (error) {
                outputChannel.error(`Failed to open diff view: ${error}`);
                vscode.window.showErrorMessage("Failed to open diff view.");
              }
            }
          )
        );
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

  public applyDiff = async (data: { path: string; incrementalUdiff: string }, repoPath: string, openViewer: boolean): Promise<boolean> => {
    this.checkInit();
    // first get the current content of the file to apply the diff on
    const originalContent = await (this.fileChangeStateManager as FileChangeStateManager).getOriginalContentToShowDiffOn(
      data.path
    );

    // then apply the diff to the original content
    let newContent;
    try {
      const authToken = await this.authService.loadAuthToken();
      const headers = {
        "Authorization": `Bearer ${authToken}`
      }
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
      return false;
    }

    // update the fileChangeStateMap with the original and modified content from the udiff
    await (this.fileChangeStateManager as FileChangeStateManager).updateFileStateInFileChangeStateMap(
      data.path,
      newContent,
      originalContent
    );

    if (openViewer) {
      // open the diff view
      await this.openDiffView(data.path);
    }

    return true;
  }


  public openDiffView = async (uri: string) => {
    if (!this.deputydevChangeProposer) {
      throw new Error("DiffManager not initialized");
    }
    await this.deputydevChangeProposer.openDiffView(uri);
  }
  public acceptAllFiles = async () => { }
  public rejectAllFiles = async () => { }
}
