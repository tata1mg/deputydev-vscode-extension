import * as vscode from 'vscode';
import { Disposable, ExtensionContext } from 'vscode';
import { TerminalManager } from '../../terminal/TerminalManager';
import { TerminalProcess } from '../../terminal/TerminalProcess';
import { ChunkCallback, Settings, ToolRequest } from '../../types';
import { getActiveRepo } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';

export interface RunOptions {
  original: string;
  requiresApproval: boolean;
  isLongRunning: boolean;
  chunkCallback: ChunkCallback;
  toolRequest: ToolRequest;
}

export class TerminalExecutor {
  constructor(
    private context: ExtensionContext,
    private terminalManager: TerminalManager,
    private logger: ReturnType<typeof SingletonLogger.getInstance>,
    /**
     * A function that registers a listener for terminal-approval events.
     * Should return a Disposable that removes the listener when disposed.
     */
    private onTerminalApprove: (listener: (args: { toolUseId: string; command: string }) => void) => Disposable,
    private outputChannel: vscode.LogOutputChannel,
  ) {
    this.logger = SingletonLogger.getInstance();
  }

  /** Top-level entry: runs the command (with approval, if needed) and returns all output. */
  public async runCommand(opts: RunOptions): Promise<string> {
    const { original, requiresApproval, isLongRunning, chunkCallback, toolRequest } = opts;
    if (!original) {
      throw new Error('Command is empty.');
    }

    // Timeouts & limits
    const timeoutSeconds = await this.context.globalState.get<number>('terminal-command-timeout');
    const uiTimeout = timeoutSeconds !== undefined ? timeoutSeconds * 1000 : 15_000;
    const timeout = isLongRunning ? uiTimeout + 40_000 : uiTimeout;
    const outputLimit = await this.context.globalState.get<number>('terminal-output-limit');

    // Determine if we need to prompt
    const deputyDevSettings = this.context.workspaceState.get('dd-settings') as Settings;

    const terminalSettings = deputyDevSettings?.terminal_settings ?? {};
    const denyList = terminalSettings.command_deny_list ?? [];
    const yoloEnabled = terminalSettings.enable_yolo_mode === true;
    const isDenied = denyList.some((deny) => original.includes(deny));
    const shouldPrompt = !yoloEnabled || requiresApproval || isDenied;

    // Possibly ask for approval/edit
    let commandToRun = original;
    let userEdited: string | undefined;

    if (shouldPrompt) {
      userEdited = await this.requestApproval(toolRequest.tool_name, toolRequest.tool_use_id, chunkCallback);
      if (userEdited) {
        commandToRun = userEdited;
      }
    } else {
      chunkCallback({
        name: 'TERMINAL_APPROVAL',
        data: {
          tool_name: toolRequest.tool_name,
          tool_use_id: toolRequest.tool_use_id,
          terminal_approval_required: false,
        },
      });
    }

    const { process, terminalId } = await this.launchProcess(commandToRun);
    return this.collectOutput(process, {
      original,
      userEdited,
      timeout,
      outputLimit,
      chunkCallback,
      terminalId,
    });
  }

  /**
   * Emits the approval prompt and waits for the user to (optionally) edit the command.
   */
  private async requestApproval(
    toolName: string,
    toolUseId: string,
    chunkCallback: ChunkCallback,
  ): Promise<string | undefined> {
    chunkCallback({
      name: 'TERMINAL_APPROVAL',
      data: {
        tool_name: toolName,
        tool_use_id: toolUseId,
        terminal_approval_required: true,
      },
    });

    return new Promise<string | undefined>((resolve) => {
      const disposable = this.onTerminalApprove(({ toolUseId: id, command }) => {
        if (id === toolUseId) {
          disposable.dispose();
          resolve(command);
        }
      });
    });
  }

  /**
   * Creates or re-uses a terminal for the active repo and runs the command.
   */
  private async launchProcess(command: string): Promise<{ process: TerminalProcess; terminalId: number }> {
    const activeRepo = getActiveRepo();
    if (!activeRepo) {
      throw new Error('Command failed: Active repository is not defined.');
    }

    this.outputChannel.info(`Launching terminal for repo: ${activeRepo}`);
    const ti = await this.terminalManager.getOrCreateTerminal(activeRepo);
    ti.terminal.show();

    const proc = this.terminalManager.runCommand(ti, command);
    // ti.id is the numeric identifier your manager uses
    return { process: proc, terminalId: ti.id };
  }

  /**
   * Collects process output with:
   *  - a banner if the user edited the command,
   *  - a timeout fallback,
   *  - a line-limit truncation,
   *  - handling of “no shell integration”,
   *  - normal completion and errors.
   */
  private collectOutput(
    process: TerminalProcess,
    opts: {
      original: string;
      userEdited?: string;
      timeout: number;
      outputLimit?: number;
      chunkCallback: ChunkCallback;
      terminalId: number;
    },
  ): Promise<string> {
    const { original, userEdited, timeout, outputLimit, chunkCallback, terminalId } = opts;
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const lines: string[] = [];

      // Prepend banner if command was edited
      if (userEdited && userEdited.trim() !== original.trim()) {
        this.outputChannel.info(`Running edited command: ${userEdited}`);
        lines.push(
          '==========',
          'User edited the command:',
          `  original: ${original}`,
          `  edited:   ${userEdited}`,
          '==========',
        );
      }

      // Fallback timer
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(
          lines.join('\n') +
            `

========== 
Process is still running after ${timeout / 1000}s; partial output returned.
==========`,
        );
      }, timeout);

      process.on('line', (line) => {
        if (settled) return;
        this.outputChannel.info(`Terminal output: ${line}`);
        lines.push(line);
        if (outputLimit && lines.length >= outputLimit) {
          settled = true;
          clearTimeout(timer);
          resolve(
            lines.join('\n') +
              `

========== 
Output exceeded ${outputLimit} lines and was truncated. Here's the all output:
==========`,
          );
        }
      });

      process.once('no_shell_integration', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chunkCallback({ name: 'TERMINAL_NO_SHELL_INTEGRATION', data: {} });
        resolve(
          `

========== 
Shell-integration unavailable; command sent to terminal only.
==========`,
        );
      });

      process.once('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.logger.error(`Process error: ${err.message}`);
        reject(err);
      });

      process.once('completed', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const trailing = this.terminalManager.getUnretrievedOutput(terminalId) || '';
        resolve(lines.join('\n') + (trailing ? '\n' + trailing : ''));
      });
    });
  }
}
