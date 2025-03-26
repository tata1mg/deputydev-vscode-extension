
import * as vscode from "vscode";

function createOutputChannel(name: string, ENABLE_OUTPUT_CHANNEL: boolean = false): vscode.LogOutputChannel {
  
  if (ENABLE_OUTPUT_CHANNEL) {
    return vscode.window.createOutputChannel(name, { log: true });
  } else {
    const noopEvent: vscode.Event<vscode.LogLevel> = (
      _listener: (e: vscode.LogLevel) => any,
      _thisArgs?: any,
      _disposables?: vscode.Disposable[]
    ): vscode.Disposable => {
      return { dispose: () => {} };
    };

    const noop: Partial<vscode.LogOutputChannel> = {
      name,
      info: () => {},
      append: () => {},
      appendLine: () => {},
      replace: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
      debug: () => {},
      logLevel: vscode.LogLevel.Info,
      onDidChangeLogLevel: noopEvent,
    };

    return noop as unknown as vscode.LogOutputChannel;
  }
}



export { createOutputChannel };