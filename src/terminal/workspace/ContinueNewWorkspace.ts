import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { sendLastChatData } from '../../utilities/contextManager';

export class ContinueNewWorkspace {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  private _onDidAuthChange = new vscode.EventEmitter<boolean>();
  public readonly onDidAuthChange = this._onDidAuthChange.event;

  private restoredSessionId?: string;
  private restoredChatData?: string;
  private hasRestored = false;

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    this.logger = SingletonLogger.getInstance();
  }

  public async init() {
    const sessionId = (await this.context.globalState.get("sessionId-copy")) as string | undefined;
    const lastChatData = (await this.context.globalState.get("chat-storage-copy")) as string | undefined;

    if (sessionId && lastChatData) {
      await vscode.commands.executeCommand("deputydev-sidebar.focus");
      const folders = vscode.workspace.workspaceFolders;
      // get last folder
      const lastFolder = folders?.[folders.length - 1];
      if (lastFolder) {
        await this.context.workspaceState.update("activeRepo", lastFolder.uri.fsPath);
      }

      // user did click “Continue Setup”:
      this.outputChannel.info(`Session ID: ${sessionId}`);

      await this.context.workspaceState.update("sessionId", sessionId);
      await this.context.globalState.update("sessionId-copy", undefined);
      await this.context.globalState.update("chat-storage-copy", undefined);

      this.restoredSessionId = sessionId;
      this.restoredChatData = lastChatData;
      const isAuthenticated = !!(await this.context.workspaceState.get("isAuthenticated"));
      this.triggerAuthChange(isAuthenticated);
      this.logger.info("Restored session from previous workspace");

    }

    // Authentication listener
    this.onDidAuthChange((isAuthenticated) => {
      if (
        isAuthenticated &&
        this.restoredChatData &&
        !this.hasRestored
      ) {
        sendLastChatData(this.restoredChatData);
        this.hasRestored = true;
      }
    });
  }

  public triggerAuthChange(isAuthenticated: boolean) {
    this._onDidAuthChange.fire(isAuthenticated);
  }
}
