// Portions of this file are derived from the Roo Code project
// https://github.com/RooCodeInc/Roo-Code
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { DDTerminalCallbacks, DDTerminalProcessResultPromise } from './types';
import { BaseTerminal } from './BaseTerminal';
import { ExecaTerminalProcess } from './ExecaTerminalProcess';
import { mergePromise } from './mergePromise';

export class ExecaTerminal extends BaseTerminal {
  constructor(id: number, cwd: string) {
    super('execa', id, cwd);
  }

  /**
   * Unlike the VSCode terminal, this is never closed.
   */
  public override isClosed(): boolean {
    return false;
  }

  public override runCommand(command: string, callbacks: DDTerminalCallbacks): DDTerminalProcessResultPromise {
    this.busy = true;

    const process = new ExecaTerminalProcess(this);
    process.command = command;
    this.process = process;

    process.on('line', (line) => callbacks.onLine(line, process));
    process.once('completed', (output) => callbacks.onCompleted(output, process));
    process.once('shell_execution_started', (pid) => callbacks.onShellExecutionStarted(pid, process));
    process.once('shell_execution_complete', (details) => callbacks.onShellExecutionComplete(details, process));

    const promise = new Promise<void>((resolve, reject) => {
      process.once('continue', () => resolve());
      process.once('error', (error) => reject(error));
      process.run(command);
    });

    return mergePromise(process, promise);
  }
}
