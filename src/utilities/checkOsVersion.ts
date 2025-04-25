// file: checkOsVersion.ts

import * as os from 'os';
import { execSync } from 'child_process';
import * as vscode from "vscode";

function isNotCompatible(): boolean {
  const platform = os.platform(); // 'darwin', 'linux', 'win32', etc.

  // if (platform === 'win32') {
  //   vscode.window.showWarningMessage(
  //         "Windows support coming soon! DeputyDev is currently MacOS-only, but we're working hard to expand. Stay tuned!"
  //       );
  //   return true;
  // }

  if (platform === 'darwin') {
    try {
      const version = execSync('sw_vers -productVersion').toString().trim(); // e.g., 14.0.1
      const [major, minor] = version.split('.').map(Number);
      if (major < 14 || (major === 14 && minor < 1)) {
        vscode.window.showWarningMessage(
          "DeputyDev requires macOS 14.1 or later. Please update your OS to use this extension."
        );
        return true;
      }
    } catch (err) {
      console.error('Error reading macOS version:', err);
    }
  }

  if (platform === 'linux') {
    const release = os.release(); // e.g., '6.2.0-36-generic'
    const kernel = release.split('-')[0]; // '6.2.0'
    const [major, minor] = kernel.split('.').map(Number);
    if (major < 6 || (major === 6 && minor < 8)) {
      vscode.window.showWarningMessage(
        "DeputyDev requires Linux kernel 6.8 or later. Please update your OS to use this extension."
      );
      return true;
    }
  }

  return false;
}

export {isNotCompatible};
