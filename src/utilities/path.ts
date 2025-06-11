import * as path from 'path';
import * as vscode from 'vscode';
import { getActiveRepo } from './contextManager';
// Safe path comparison that works across different platforms
export function arePathsEqual(path1?: string, path2?: string): boolean {
  if (!path1 && !path2) {
    return true;
  }
  if (!path1 || !path2) {
    return false;
  }

  path1 = normalizePath(path1);
  path2 = normalizePath(path2);

  if (process.platform === 'win32') {
    return path1.toLowerCase() === path2.toLowerCase();
  }
  return path1 === path2;
}

function normalizePath(p: string): string {
  // normalize resolve ./.. segments, removes duplicate slashes, and standardizes path separators
  let normalized = path.normalize(p);
  // however it doesn't remove trailing slashes
  // remove trailing slash, except for root paths
  if (normalized.length > 1 && (normalized.endsWith('/') || normalized.endsWith('\\'))) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false; // Will throw if file does not exist
  }
}

export async function openFile(file_path: string, startLine?: number, endLine?: number) {
  const active_repo = getActiveRepo();
  if (!active_repo) {
    vscode.window.showErrorMessage('No workspace folder found.');
    return;
  }
  const absolutePath = path.join(active_repo, file_path);
  const uri = vscode.Uri.file(absolutePath);
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);

  if (typeof startLine === 'number' && typeof endLine === 'number') {
    // Convert to 0-based
    const start = startLine - 1;
    const end = endLine - 1;

    // If both start and end are out of bounds, just open the file.
    if (start >= document.lineCount && end >= document.lineCount) {
      return;
    }

    // Clamp start line
    const clampedStart = Math.max(0, Math.min(start, document.lineCount - 1));

    // Determine end position
    let endPosition: vscode.Position;
    if (end >= document.lineCount) {
      // End out of bounds: select till EOF
      const lastLine = document.lineCount - 1;
      endPosition = new vscode.Position(lastLine, document.lineAt(lastLine).text.length);
    } else {
      // End within bounds
      const clampedEnd = Math.max(0, end);
      endPosition = new vscode.Position(clampedEnd, document.lineAt(clampedEnd).text.length);
    }

    const startPosition = new vscode.Position(clampedStart, 0);
    editor.selection = new vscode.Selection(startPosition, endPosition);
    editor.revealRange(new vscode.Range(startPosition, endPosition), vscode.TextEditorRevealType.InCenter);
  } else if (typeof startLine === 'number' && typeof endLine !== 'number') {
    // Only startLine given: just go to that line, no selection
    const line = Math.max(0, Math.min(startLine - 1, document.lineCount - 1));
    const position = new vscode.Position(line, 0);

    editor.selection = new vscode.Selection(position, position); // Move cursor to line start, no selection
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  }
}
