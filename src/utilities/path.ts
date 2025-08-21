import * as path from 'path';
import * as vscode from 'vscode';
import fs from 'fs/promises';
import { getActiveRepo, getContextRepositories, getRepoAndRelativeFilePath } from './contextManager';

/**
 * Canonicalize a path for equality/containment checks:
 * - resolve + normalize
 * - strip trailing slash (except root)
 * - case-insensitive on Windows
 */
function canonicalizePath(p: string): string {
  let resolved = path.normalize(path.resolve(p));
  if (resolved.length > 1 && (resolved.endsWith('/') || resolved.endsWith('\\'))) {
    resolved = resolved.slice(0, -1);
  }
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

// Safe path comparison that works across different platforms
export function arePathsEqual(path1?: string, path2?: string): boolean {
  if (!path1 && !path2) return true;
  if (!path1 || !path2) return false;

  const a = canonicalizePath(path1);
  const b = canonicalizePath(path2);
  return a === b;
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
 * @param filePath - The path to check.
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

  // If already relative, just normalize and return (forward slashes for consistency)
  if (!path.isAbsolute(directory)) {
    return directory.replace(/\\/g, '/');
  }

  // For absolute path: reuse repo detection
  const info = await getRepoInfoForAbsPath(directory);
  if (!info) {
    throw new Error(`No matching repository found for path: "${directory}"`);
  }

  // '.' when directory equals repo root
  const rel = info.repoRelPath;
  return rel === '' ? '.' : rel.replace(/\\/g, '/');
}

export interface RepoInfo {
  repoPath: string; // absolute repo root
  repoRelPath: string; // path within the repo
}

/**
 * Given an absolute file path (or a file:// URI string), return the repo root and repo-relative path.
 * Returns null if the path doesn't live under any known repo/workspace root.
 */
export async function getRepoInfoForAbsPath(absOrUri: string): Promise<RepoInfo | null> {
  // Normalize input to absolute filesystem path
  let abs = absOrUri;
  if (abs.startsWith('file://')) {
    try {
      abs = vscode.Uri.parse(abs).fsPath;
    } catch {
      return null;
    }
  }
  abs = path.resolve(abs);

  // Collect candidate roots: context repos first, then workspace folders
  const roots: string[] = [];

  try {
    const contextRepos = (await getContextRepositories?.()) ?? [];
    for (const r of contextRepos) {
      if (r?.repo_path) roots.push(path.resolve(r.repo_path));
    }
  } catch (e) {
    // Failed to get context repositories
  }

  for (const f of vscode.workspace.workspaceFolders ?? []) {
    if (f.uri.scheme === 'file') roots.push(path.resolve(f.uri.fsPath));
  }

  if (roots.length === 0) {
    return null;
  }

  // Pick the longest matching root (handles nested repos)
  const best = pickBestRoot(abs, roots);
  if (!best) {
    return null;
  }

  const repoRelPath = path.relative(best, abs);
  return { repoPath: best, repoRelPath };
}

/** Return the longest root that contains the path (case-insensitive on Windows). */
function pickBestRoot(absChild: string, roots: string[]): string | null {
  let best: string | null = null;
  for (const root of roots) {
    if (isUnder(absChild, root)) {
      if (!best || root.length > best.length) best = root;
    }
  }
  return best;
}

/** True if childAbs is inside parentAbs (or equal). */
export function isUnder(childAbs: string, parentAbs: string): boolean {
  const child = canonicalizePath(childAbs);
  const parent = canonicalizePath(parentAbs);
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function absolutePathForUri(uri: vscode.Uri): string {
  if (uri.scheme === 'file') {
    const abs = path.resolve(uri.fsPath);
    return abs;
  }
  // Non-file URIs don’t have a filesystem path; return the URI string.
  // (This keeps the API total; callers can branch on `uri.startsWith("file://")` if needed.)
  const asString = uri.toString();
  return asString;
}

export function toFilePath(uri: vscode.Uri): string {
  return absolutePathForUri(uri);
}

export function fromFilePath(filePath: string): vscode.Uri {
  if (filePath.startsWith('file://')) {
    return vscode.Uri.parse(filePath);
  }
  if (path.isAbsolute(filePath)) {
    return vscode.Uri.file(filePath);
  }
  const activeRepo = getActiveRepo();
  if (activeRepo) {
    return vscode.Uri.file(path.join(activeRepo, filePath));
  }
  return vscode.Uri.file(filePath);
}

export async function tryRepoInfo(absPath: string): Promise<{ repoPath?: string; repoRelPath?: string }> {
  try {
    const info = await getRepoInfoForAbsPath(absPath);
    if (info?.repoPath && info?.repoRelPath !== undefined) {
      return { repoPath: info.repoPath, repoRelPath: info.repoRelPath };
    }
  } catch (e) {
    // Ignore errors, just return empty object
  }
  return {};
}
