import * as os from 'os';
import { execSync } from 'child_process';
import * as vscode from 'vscode';

function isNotCompatible(): boolean {
  const platform = os.platform(); // 'darwin', 'linux', 'win32', etc.
  const arch = os.arch();

  if (platform === 'win32' && (arch === 'arm' || arch === 'arm64')) {
    vscode.window.showWarningMessage(
      "DeputyDev is now available on Windows (x64)! ARM-based Windows devices aren't supported yet—but we're working on it. Stay tuned!",
    );
    return true;
  }

  // Windows: Check for Docker
  if (platform === 'win32') {
    try {
      execSync('docker --version');
      // Docker exists, do nothing.
    } catch (err) {
      vscode.window.showWarningMessage(
        'DeputyDev requires Docker Desktop to be installed on Windows. Please install Docker Desktop and ensure it is available in your PATH.'
      );
      return true;
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
        return true;
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
      return true;
    }
  }

  // Check for Git version >= 2.36.0
  try {
    const gitOutput = execSync('git --version').toString().trim(); // e.g., git version 2.36.0
    const gitVersion = gitOutput.split(' ')[2]; // "2.36.0"
    const [major, minor] = gitVersion.split('.').map(Number);
    if (major < 2 || (major === 2 && minor < 36)) {
      vscode.window.showWarningMessage(
        `DeputyDev requires Git version 2.36.0 or later. You have ${gitVersion}. Please update Git to continue.`,
      );
      return true;
    }
  } catch (err) {
    vscode.window.showWarningMessage(
      'Git is not installed or not available in PATH. Please install Git (version 2.36.0 or later) to use this extension.',
    );
    return true;
  }

  return false;
}

export { isNotCompatible };
