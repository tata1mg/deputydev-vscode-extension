import EventEmitter from 'events';

export type DDTerminalProvider = 'vscode' | 'execa';

export interface DDTerminal {
  provider: DDTerminalProvider;
  id: number;
  busy: boolean;
  running: boolean;
  taskId?: string;
  process?: DDTerminalProcess;
  getCurrentWorkingDirectory(): string;
  isClosed: () => boolean;
  runCommand: (command: string, callbacks: DDTerminalCallbacks) => DDTerminalProcessResultPromise;
  setActiveStream(stream: AsyncIterable<string> | undefined, pid?: number): void;
  shellExecutionComplete(exitDetails: ExitCodeDetails): void;
  getProcessesWithOutput(): DDTerminalProcess[];
  getUnretrievedOutput(): string;
  getLastCommand(): string;
  cleanCompletedProcessQueue(): void;
}

export interface DDTerminalCallbacks {
  onLine: (line: string, process: DDTerminalProcess) => void;
  onCompleted: (output: string | undefined, process: DDTerminalProcess) => void;
  onShellExecutionStarted: (pid: number | undefined, process: DDTerminalProcess) => void;
  onShellExecutionComplete: (details: ExitCodeDetails, process: DDTerminalProcess) => void;
  onNoShellIntegration?: (message: string, process: DDTerminalProcess) => void;
}

export interface DDTerminalProcess extends EventEmitter<DDTerminalProcessEvents> {
  command: string;
  isHot: boolean;
  run: (command: string) => Promise<void>;
  continue: () => void;
  abort: () => void;
  hasUnretrievedOutput: () => boolean;
  getUnretrievedOutput: () => string;
}

export type DDTerminalProcessResultPromise = DDTerminalProcess & Promise<void>;

export interface DDTerminalProcessEvents {
  line: [line: string];
  continue: [];
  completed: [output?: string];
  stream_available: [stream: AsyncIterable<string>];
  shell_execution_started: [pid: number | undefined];
  shell_execution_complete: [exitDetails: ExitCodeDetails];
  error: [error: Error];
  no_shell_integration: [message: string];
}

export interface ExitCodeDetails {
  exitCode: number | undefined;
  signal?: number | undefined;
  signalName?: string;
  coreDumpPossible?: boolean;
}

// 1a) Define each variant as an interface

interface StartedStatus {
  executionId: string;
  status: 'started';
  pid?: number;
  command: string;
}

interface OutputStatus {
  executionId: string;
  status: 'output';
  output: string;
}

interface ExitedStatus {
  executionId: string;
  status: 'exited';
  exitCode?: number;
}

interface FallbackStatus {
  executionId: string;
  status: 'fallback';
}

// 1b) Union them into one type

export type CommandExecutionStatus = StartedStatus | OutputStatus | ExitedStatus | FallbackStatus;
