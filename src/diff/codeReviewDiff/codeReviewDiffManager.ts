import path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { fileExists } from '../../utilities/path';
import { getActiveRepo } from '../../utilities/contextManager';

export class CodeReviewDiffManager {
  constructor() {}

  public async openFileDiff(udiff: string, filePath: string, fileName: string) {
    console.log('openFileDiff called with:', { udiff, filePath, fileName }); // Add this
    if (!udiff || !filePath || !fileName) {
      console.error('Missing required parameters:', { udiff, filePath, fileName });
      return;
    }
    const active_repo = getActiveRepo();
    const absolutePath = active_repo && path.join(active_repo, filePath);
    if (!absolutePath) {
      return;
    }
    try {
      const fileUri = vscode.Uri.file(absolutePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const currentContent = Buffer.from(fileContent).toString('utf8');
      const oldContent = this.generateOldContent(currentContent, udiff);
      this.showInlineDiffForCodeReview(oldContent, currentContent, fileName);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show diff: ${error}`);
    }
  }

  public async showInlineDiffForCodeReview(
    originalContent: string,
    modifiedContent: string,
    fileName: string = 'diff',
  ) {
    try {
      // Create temp files
      const tempDir = os.tmpdir();
      let originalUri = vscode.Uri.file(path.join(tempDir, `${fileName}.original`));
      let modifiedUri = vscode.Uri.file(path.join(tempDir, `${fileName}.modified`));

      // Create a unique filename to avoid conflicts
      let counter = 1;
      while ((await fileExists(originalUri)) || (await fileExists(modifiedUri))) {
        const newFileName = `${fileName}${counter}`;
        originalUri = vscode.Uri.file(path.join(tempDir, `${newFileName}.original`));
        modifiedUri = vscode.Uri.file(path.join(tempDir, `${newFileName}.modified`));
        counter++;
      }

      // Write content to temp files
      await vscode.workspace.fs.writeFile(originalUri, Buffer.from(originalContent));
      await vscode.workspace.fs.writeFile(modifiedUri, Buffer.from(modifiedContent));

      // Show diff
      const title = `${path.basename(fileName)} (Changes)`;
      await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, title, { preview: false });

      // Clean up temp files when the diff editor is closed
      const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (
          !editor ||
          (editor.document.uri.toString() !== originalUri.toString() &&
            editor.document.uri.toString() !== modifiedUri.toString())
        ) {
          vscode.workspace.fs.delete(originalUri, { useTrash: false });
          vscode.workspace.fs.delete(modifiedUri, { useTrash: false });
          disposable.dispose();
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show diff: ${error}`);
    }
  }

  public async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  public parseDiff(diffText: string) {
    const hunks: {
      old_start: number;
      old_len: number;
      new_start: number;
      new_len: number;
      lines: string[];
    }[] = [];

    const lines = diffText.split(/\r?\n/);
    let hunk: any = null;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
        if (m) {
          const old_start = parseInt(m[1], 10);
          const old_len = m[2] ? parseInt(m[2], 10) : 1;
          const new_start = parseInt(m[3], 10);
          const new_len = m[4] ? parseInt(m[4], 10) : 1;

          if (hunk) {
            hunks.push(hunk);
          }

          hunk = {
            old_start,
            old_len,
            new_start,
            new_len,
            lines: [],
          };
        }
      } else if (hunk) {
        hunk.lines.push(line);
      }
    }

    if (hunk) {
      hunks.push(hunk);
    }

    return hunks;
  }

  public generateOldContent(currentContent: string, diffText: string): string {
    const lines = currentContent.split(/\r?\n/);
    const hunks = this.parseDiff(diffText);

    // Apply hunks in reverse order
    for (let i = hunks.length - 1; i >= 0; i--) {
      const hunk = hunks[i];
      const newStartIdx = hunk.new_start - 1;
      const newLen = hunk.new_len;

      const reconstructedOldLines: string[] = [];
      for (const diffLine of hunk.lines) {
        if (diffLine.startsWith('-') || diffLine.startsWith(' ')) {
          reconstructedOldLines.push(diffLine.slice(1));
        }
        // skip lines starting with '+'
      }

      // Replace current lines with old lines reconstructed from diff
      lines.splice(newStartIdx, newLen, ...reconstructedOldLines);
    }

    return lines.join('\n');
  }
}
