import * as os from 'os';
import { execSync } from 'child_process';
import * as vscode from 'vscode';

function checkIfExtensionIsCompatible(): boolean {
  const platform = os.platform(); // 'darwin', 'linux', 'win32', etc.
  // Windows: Check for Docker
  if (platform === 'win32') {
    try {
      execSync('docker --version');
      // Docker exists, do nothing.
    } catch (err) {
      vscode.window.showWarningMessage(
        'DeputyDev requires Docker Desktop to be installed on Windows. Please install Docker Desktop and ensure it is available in your PATH.',
      );
      return false;
    }
  }

  if (platform === 'darwin') {
    try {
      const version = execSync('sw_vers -productVersion').toString().trim(); // e.g., 14.0.1
      const [major, minor] = version.split('.').map(Number);
      if (major < 14 || (major === 14 && minor < 1)) {
        vscode.window.showWarningMessage(
          'DeputyDev requires macOS 14.1 or later. Please update your OS to use this extension.',
        );
        return false;
      }
    } catch (err) {
      // console.error('Error reading macOS version:', err);
    }
  }

  return true;
}

export { checkIfExtensionIsCompatible };
