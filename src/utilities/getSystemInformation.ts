import * as vscode from 'vscode';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getOSName } from './osName';

const execAsync = promisify(exec);

async function getCommandVersion(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`${command} --version`);
    return stdout.trim();
  } catch {
    return 'Not installed';
  }
}

async function getHumanReadableOSVersion(): Promise<string> {
  const platform = os.platform();

  if (platform === 'darwin') {
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      return `macOS ${stdout.trim()}`;
    } catch {
      return `macOS (Darwin ${os.release()})`;
    }
  }

  if (platform === 'win32') {
    try {
      const { stdout } = await execAsync('wmic os get Caption');
      const lines = stdout.trim().split('\n');
      return lines[1]?.trim() || `Windows (Build ${os.release()})`;
    } catch {
      return `Windows (Build ${os.release()})`;
    }
  }

  if (platform === 'linux') {
    try {
      const { stdout } = await execAsync('lsb_release -ds');
      return stdout.trim().replace(/"/g, '');
    } catch {
      return `Linux (Kernel ${os.release()})`;
    }
  }

  return os.release(); // fallback
}

export async function setUserSystemData(extensionContext: vscode.ExtensionContext) {
  const osName = await getOSName();
  const osVersion = await getHumanReadableOSVersion();
  const cpuArch = os.arch();
  const vscodeVersion = vscode.version;
  const dockerVersion = await getCommandVersion('docker');
  const gitVersion = await getCommandVersion('git');

  const userSystemData = {
    osName,
    osVersion,
    cpuArch,
    vscodeVersion,
    dockerVersion,
    gitVersion,
  };

  await extensionContext.globalState.update('user-system-data', userSystemData);
}
