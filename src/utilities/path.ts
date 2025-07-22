import * as path from 'path';
import * as vscode from 'vscode';
import fs from 'fs/promises';
import { getActiveRepo, getContextRepositories, getRepoAndRelativeFilePath } from './contextManager';
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

/**
 * Helper function to check if a path exists.
 *
 * @param path - The path to check.
 * @returns A promise that resolves to true if the path exists, false otherwise.
 */
export async function fileExistsAtPath(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function openFile(file_path: string, startLine?: number, endLine?: number, forActiveFile?: boolean) {
  const { repoPath, relativeFilePath } = await getRepoAndRelativeFilePath(file_path);

  const absolutePath = forActiveFile ? file_path : path.join(repoPath, relativeFilePath);
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

export async function checkFileExists(file_path: string): Promise<boolean> {
  const { repoPath, relativeFilePath } = await getRepoAndRelativeFilePath(file_path);
  const absolutePath = path.join(repoPath, relativeFilePath);
  const uri = vscode.Uri.file(absolutePath);

  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (err: any) {
    // File does not exist or cannot be accessed
    if (err?.code === 'FileNotFound' || err?.code === 'ENOENT') {
      return false;
    }
    // Could be a different error; rethrow or log as needed
    return false;
  }
}

/**
 * Resolve a directory path against a repo root,
 * always returning it relative to the correct context repo's root.
 *
 * @param directory - Either an absolute path or a path relative to some repo.
 * @returns A normalized path relative to the matched repo root ('.' if it is the root).
 * @throws If no repo is open, the input is invalid, or no matching repo is found.
 */
export async function resolveDirectoryRelative(directory?: string): Promise<string> {
  if (typeof directory !== 'string' || !directory.trim()) {
    throw new TypeError('directory must be a non-empty string');
  }

  // If already relative, just normalize and return
  if (!path.isAbsolute(directory)) {
    // Normalize separators to forward-slashes for consistency
    return directory.replace(/\\/g, '/');
  }

  // For absolute path: check which repo it belongs to
  const contextRepos = await getContextRepositories();
  if (!contextRepos.length) {
    throw new Error('No active repositories found.');
  }

  // Find the repo whose path is a prefix of the directory
  for (const repo of contextRepos) {
    // Make sure both paths are resolved and absolute
    const repoRoot = path.resolve(repo.repo_path);
    if (directory.startsWith(repoRoot)) {
      // Get the relative path
      const rel = path.relative(repoRoot, path.normalize(directory));
      return rel === '' ? '.' : rel.replace(/\\/g, '/');
    }
  }

  // No matching repo found
  throw new Error(`No matching repository found for path: "${directory}"`);
}
