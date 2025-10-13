import * as vscode from 'vscode';
import { Disposable, ExtensionContext } from 'vscode';
import { ChunkCallback, Settings, ToolRequest } from '../../types';
import { terminalProcessCompleted } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { Terminal } from '../../terminal/Terminal';
import { ExitCodeDetails, DDTerminalCallbacks, DDTerminalProcess } from '../../terminal/types';
import { TerminalRegistry } from '../../terminal/TerminalRegistry';

export interface RunOptions {
  original: string;
  requiresApproval: boolean;
  isLongRunning: boolean;
  chunkCallback: ChunkCallback;
  toolRequest: ToolRequest;
  repoPath: string;
}

/** Which backend actually executes the shell command. */
enum TerminalProvider {
  VSCODE = 'vscode',
  EXECA = 'execa',
}

class ShellIntegrationError extends Error {}

export class TerminalExecutor {
  constructor(
    private context: ExtensionContext,
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

  //───────────────────────────────────────────────────────────────────────────────
  //  Public API
  //───────────────────────────────────────────────────────────────────────────────
  private runningProcesses: Map<string, DDTerminalProcess> = new Map();

  /**
   * 1. Validates input & policies
   * 2. Optionally prompts for approval
   * 3. Spawns the command with VS Code shell-integration or execa fallback
   * 4. Streams / truncates / times-out output and returns the final string
   */
  public async runCommand(opts: RunOptions): Promise<string> {
    const { original, requiresApproval, isLongRunning, chunkCallback, toolRequest, repoPath } = opts;
    if (!original) {
      throw new Error('Command is empty.');
    }

    //───────────────────────────────────────────────────────────────────────────
    //  Settings & policies
    //───────────────────────────────────────────────────────────────────────────
    const timeoutSeconds = await this.context.globalState.get<number>('terminal-command-timeout');
    const uiTimeout = timeoutSeconds !== undefined ? timeoutSeconds * 1000 : 15_000;
    const timeout = isLongRunning ? uiTimeout + 40_000 : uiTimeout;
    const terminalOutputLineLimit = await this.context.globalState.get<number>('terminal-output-limit');

    const shellIntegrationTimeoutState = await this.context.globalState.get<number>('terminal-shell-limit');
    const shellIntegrationTimeout =
      shellIntegrationTimeoutState !== undefined ? shellIntegrationTimeoutState * 1000 : 5_000;
    Terminal.setShellIntegrationTimeout(shellIntegrationTimeout);

    this.outputChannel.info(
      `Running command: "${original}" with timeout ${timeout / 1000}s and line limit ${terminalOutputLineLimit}`,
    ); //remove this line in production
    // Workspace‑level terminal behaviour
    const deputyDevSettings = this.context.workspaceState.get('dd-settings') as Settings;
    const terminalSettings = deputyDevSettings?.terminal_settings ?? {};

    const denyList: string[] = terminalSettings.command_deny_list ?? [];
    const yoloEnabled = terminalSettings.enable_yolo_mode === true;
    const disableShellIntegration = await this.context.globalState.get<boolean>('disable-shell-integration'); // NEW setting
    this.outputChannel.info(`YOLO mode: ${yoloEnabled}, Shell integration disabled: ${disableShellIntegration}`);
    const isDenied = denyList.some((deny) => original.includes(deny));
    const shouldPrompt = !yoloEnabled || requiresApproval || isDenied;

    //───────────────────────────────────────────────────────────────────────────
    //  Possibly prompt the user for approval / edits
    //───────────────────────────────────────────────────────────────────────────
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

    //───────────────────────────────────────────────────────────────────────────
    //  Decide which provider to use and launch the process
    //───────────────────────────────────────────────────────────────────────────

    const preferredProvider: TerminalProvider = disableShellIntegration
      ? TerminalProvider.EXECA
      : TerminalProvider.VSCODE;

    const { process, terminalId, providerActuallyUsed } = await this.launchProcess(
      commandToRun,
      preferredProvider,
      chunkCallback,
      toolRequest,
      repoPath,
    );

    // Only track if Execa provider is used
    if (providerActuallyUsed === TerminalProvider.EXECA) {
      // Track the process using some unique key (e.g., toolUseId)
      this.runningProcesses.set(toolRequest.tool_use_id, process);
    }

    return this.collectOutput(process, {
      original,
      userEdited,
      timeout,
      terminalOutputLineLimit,
      chunkCallback,
      terminalId,
      provider: providerActuallyUsed,
      toolRequest,
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
   * Launches the command. Tries VS Code first and transparently falls back to
   * execa if shell integration is unavailable.
   */
  private async launchProcess(
    command: string,
    provider: TerminalProvider,
    chunkCallback: ChunkCallback,
    toolRequest: ToolRequest,
    repoPath: string,
  ): Promise<{
    process: DDTerminalProcess;
    terminalId: number;
    providerActuallyUsed: TerminalProvider;
  }> {
    this.outputChannel.info(`Launching command in repo: ${repoPath}`);

    let shellIntegrationError: string | undefined;
    let process: DDTerminalProcess;
    let terminalId: number;
    let actualProvider: TerminalProvider;

    const callbacks: DDTerminalCallbacks = {
      onLine: async (lines: string, proc: DDTerminalProcess) => {
        if (provider === TerminalProvider.EXECA) {
          chunkCallback({
            name: 'EXECA_TERMINAL_PROCESS_LINES',
            data: {
              tool_use_id: toolRequest.tool_use_id,
              output_lines: lines,
            },
          });
        }
      },
      onCompleted: (output: string | undefined) => {
        // this.outputChannel.info(`Terminal completed with output: ${output}`);
      },
      onShellExecutionStarted: (pid: number | undefined) => {
        this.outputChannel.info(`Shell execution started with PID: ${pid} and provider: ${actualProvider}`);
        if (provider === TerminalProvider.EXECA) {
          this.outputChannel.info(`sending EXECA_TERMINAL_PROCESS_STARTED event with PID: ${pid}`);
          chunkCallback({
            name: 'EXECA_TERMINAL_PROCESS_STARTED',
            data: {
              tool_use_id: toolRequest.tool_use_id,
              process_id: pid,
            },
          });
        }
      },
      onShellExecutionComplete: (details: ExitCodeDetails) => {
        this.outputChannel.info(`Shell execution completed with exit code: ${details.exitCode}`);
        if (provider === TerminalProvider.EXECA && typeof details.exitCode === 'number') {
          terminalProcessCompleted({ toolUseId: toolRequest.tool_use_id, exitCode: details.exitCode });
          chunkCallback({
            name: 'EXECA_TERMINAL_PROCESS_COMPLETED',
            data: {
              tool_use_id: toolRequest.tool_use_id,
              exit_code: details.exitCode,
            },
          });
        }
      },
      onNoShellIntegration: async (error: string) => {
        this.outputChannel.warn(`No shell integration: ${error}`);
        shellIntegrationError = error;
        // Persist the shell integration failure for future runs
        chunkCallback({ name: 'TERMINAL_NO_SHELL_INTEGRATION', data: {} });
        await this.context.globalState.update('disable-shell-integration', true);
        // Show warning to user (similar to original's "shell_integration_warning")
        // vscode.window.showWarningMessage(
        //   'Shell integration is not available. Future terminal commands will use the fallback terminal provider.',
        //   'OK',
        // );
      },
    };

    // Try the preferred provider first
    if (provider === TerminalProvider.VSCODE) {
      try {
        const terminal = await TerminalRegistry.getOrCreateTerminal(repoPath, true, undefined, 'vscode');
        if (terminal instanceof Terminal) {
          terminal.terminal.show(true);
        }
        terminalId = terminal.id;
        process = terminal.runCommand(command, callbacks);
        actualProvider = TerminalProvider.VSCODE;

        // Wait a bit to see if shell integration works
        this.outputChannel.info(
          `Command "${command}" launched in terminal ${terminalId} using provider ${actualProvider}`,
        );
        if (shellIntegrationError) {
          this.outputChannel.warn('Shell integration error detected, falling back to execa. after 100ms');
          throw new ShellIntegrationError(shellIntegrationError);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { process, terminalId, providerActuallyUsed: actualProvider };
      } catch (err) {
        if (err instanceof ShellIntegrationError) {
          this.outputChannel.warn('Shell integration unavailable');
        } else {
          throw err;
        }
      }
    }

    // Execa fallback (or direct execa if requested)
    this.outputChannel.info('Using execa provider for command execution');

    const execaTerminal = await TerminalRegistry.getOrCreateTerminal(repoPath, true, undefined, 'execa');
    process = execaTerminal.runCommand(command, callbacks);
    terminalId = execaTerminal.id;
    actualProvider = TerminalProvider.EXECA;

    return { process, terminalId, providerActuallyUsed: actualProvider };
  }

  public abortCommand(toolUseId: string) {
    const process = this.runningProcesses.get(toolUseId);
    if (process) {
      try {
        this.logger.info(`Aborting command with toolUseId: ${toolUseId}`);
        this.outputChannel.info(`Aborting command with toolUseId: ${toolUseId}`);
        process.abort();
        this.runningProcesses.delete(toolUseId);
      } catch (err) {
        this.logger.warn(`Failed to abort process for toolUseId ${toolUseId}: ${err}`);
        this.outputChannel.warn(
          `Failed to abort process for toolUseId ${toolUseId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  public abortAllCommands() {
    for (const [toolUseId, process] of this.runningProcesses.entries()) {
      try {
        this.logger.info(`Aborting process ${toolUseId}`);
        process.abort();
      } catch (err) {
        this.outputChannel.warn(`Failed to abort process ${toolUseId}: ${err instanceof Error ? err.message : err}`);
        this.logger.warn(`Failed to abort process ${toolUseId}: ${err}`);
      }
    }
    this.runningProcesses.clear();
  }

  /**
   * Collects process output with:
   *  - a banner if the user edited the command,
   *  - a timeout fallback,
   *  - a line-limit truncation,
   *  - handling of "no shell integration",
   *  - normal completion and errors.
   */
  private collectOutput(
    process: DDTerminalProcess,
    opts: {
      original: string;
      userEdited?: string;
      timeout: number;
      terminalOutputLineLimit?: number;
      chunkCallback: ChunkCallback;
      terminalId: number;
      provider: TerminalProvider;
      toolRequest: ToolRequest;
    },
  ): Promise<string> {
    const { original, userEdited, timeout, terminalOutputLineLimit, chunkCallback, terminalId, provider } = opts;
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

      // Set up event handlers
      process.on('line', (line) => {
        if (settled) return;
        this.outputChannel.info(`Terminal output at collectOuput: ${line}`);
        lines.push(line);
        if (provider === TerminalProvider.EXECA) {
          chunkCallback({
            name: 'EXECA_TERMINAL_PROCESS_OUTPUT',
            data: {
              tool_use_id: opts.toolRequest.tool_use_id,
              output_lines: line,
            },
          });
        }
        if (terminalOutputLineLimit && lines.length >= terminalOutputLineLimit) {
          settled = true;
          clearTimeout(timer);
          resolve(
            lines.join('\n') +
              `\n\n==========\nOutput exceeded ${terminalOutputLineLimit} lines and was truncated. Here's the partial output.\n==========`,
          );
        }
      });

      // Shell‑integration‑specific event – only emitted by VS Code provider
      process.once('no_shell_integration', () => {
        this.outputChannel.warn(`No shell integration available for command: ${original}`);
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(
          `\n\n==========\nShell integration is unavailable. The command was sent to the terminal, but its execution and output could not be verified. If seeing the output is important, you can re-run the command — it will now use the fallback execution method, which reliably captures output.\n==========`,
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

        // Retrieve any output that arrived *after* the last 'line' event we saw
        let trailing = '';
        if (terminalId !== -1) {
          trailing = TerminalRegistry.getUnretrievedOutput(terminalId) || '';
        }
        if (provider === TerminalProvider.EXECA) {
          chunkCallback({
            name: 'EXECA_TERMINAL_PROCESS_OUTPUT',
            data: {
              tool_use_id: opts.toolRequest.tool_use_id,
              output_lines: trailing,
            },
          });
        }
        resolve(lines.join('\n') + (trailing ? '\n' + trailing : ''));
      });
    });
  }
}
