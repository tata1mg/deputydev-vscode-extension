import * as vscode from "vscode";
import { FileChangeStateManager } from "./fileChangeStateManager/fileChangeStateManager";
import { DeputydevChangeProposer } from "./viewers/deputydevChangeProposer/deputydevChangeProposer";


export class DiffManager {
  private changeStateStorePath: string;
  private vscodeContext: vscode.ExtensionContext;
  private outputChannel: vscode.LogOutputChannel;

  private deputydevChangeProposer: DeputydevChangeProposer | undefined;

  constructor(vscodeContext: vscode.ExtensionContext, changeStateStorePath: string, outputChannel: vscode.LogOutputChannel) {
    this.changeStateStorePath = changeStateStorePath;
    this.vscodeContext = vscodeContext;
    this.outputChannel = outputChannel;
  }

  // initialize the diff manager
  public init = async () => {
    let fileChangeStateManager = new FileChangeStateManager(
      this.vscodeContext,
      this.outputChannel,
    );

    this.deputydevChangeProposer = new DeputydevChangeProposer(
      this.vscodeContext,
      this.outputChannel,
      fileChangeStateManager,
    );
    await this.deputydevChangeProposer.init();
  }
}
