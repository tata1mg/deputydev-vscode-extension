import * as os from 'os';
import { execSync } from 'child_process';
import * as vscode from 'vscode';

function checkIfExtensionIsCompatible(): boolean {
  const platform = os.platform(); // 'darwin', 'linux', 'win32', etc.
  const arch = os.arch();

  if (platform === 'win32' && (arch === 'arm' || arch === 'arm64')) {
    vscode.window.showWarningMessage(
      "DeputyDev is now available on Windows (x64)! ARM-based Windows devices aren't supported yet—but we're working on it. Stay tuned!",
    );
    return false;
  }

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

  if (platform === 'linux') {
    const release = os.release(); // e.g., '6.2.0-36-generic'
    const kernel = release.split('-')[0]; // '6.2.0'
    const [major, minor] = kernel.split('.').map(Number);
    if (major < 6 || (major === 6 && minor < 8)) {
      vscode.window.showWarningMessage(
        'DeputyDev requires Linux kernel 6.8 or later. Please update your OS to use this extension.',
      );
      return false;
    }
  }
  return true;
}

export { checkIfExtensionIsCompatible };
