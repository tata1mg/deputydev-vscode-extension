import * as vscode from 'vscode';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { sendLastChatData } from '../../utilities/contextManager';
import { getIsLspReady } from '../../languageServer/lspStatus';

export class ContinueNewWorkspace {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  private _onDidAuthChange = new vscode.EventEmitter<boolean>();
  public readonly onDidAuthChange = this._onDidAuthChange.event;

  private restoredChatId?: string;
  private restoredChatData?: string;
  private hasRestored = false;

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    this.logger = SingletonLogger.getInstance();
  }

  public async init() {
    const lastChatData = (await this.context.globalState.get('chat-storage-copy')) as string | undefined;

    const chatId = (await this.context.globalState.get('chatId-copy')) as string | undefined;

    if (chatId && lastChatData) {
      this.restoredChatId = chatId;
      this.restoredChatData = lastChatData;
      await vscode.commands.executeCommand('deputydev-sidebar.focus');
      const folders = vscode.workspace.workspaceFolders;
      // get last folder
      const lastFolder = folders?.[folders.length - 1];
      if (lastFolder) {
        await this.context.workspaceState.update('activeRepo', lastFolder.uri.fsPath);
        getIsLspReady({ force: true, repoPath: lastFolder.uri.fsPath });
      }

      // user did click “Continue Setup”:
      this.outputChannel.info(`Chat ID: ${chatId}`);
      await this.context.globalState.update('chatId-copy', undefined);
      await this.context.globalState.update('chat-storage-copy', undefined);
      const isAuthenticated = !!(await this.context.workspaceState.get('isAuthenticated'));
      this.triggerAuthChange(isAuthenticated);
      this.logger.info('Restored session from previous workspace');
    }

    // Authentication listener
    this.onDidAuthChange((isAuthenticated) => {
      if (isAuthenticated && this.restoredChatId && !this.hasRestored && this.restoredChatData) {
        sendLastChatData(this.restoredChatId, this.restoredChatData);
        this.hasRestored = true;
      }
    });
  }

  public triggerAuthChange(isAuthenticated: boolean) {
    this._onDidAuthChange.fire(isAuthenticated);
  }
}
