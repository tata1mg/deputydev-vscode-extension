// File: src/diff/DiffContentProvider.ts

import * as vscode from 'vscode';

/**
 * A simple TextDocumentContentProvider that expects the file's content
 * to be passed in the URI's `query` parameter, base64-encoded.
 *
 * e.g. "my-diff-scheme:/absolute/path/to/file.js?BASE64-ENCODED-CONTENT"
 */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  /**
   * This is the key method VS Code calls to retrieve text for URIs registered to our scheme.
   * We decode the `uri.query` and return it as plain text.
   */
  public provideTextDocumentContent(uri: vscode.Uri): string {
    // The `uri.query` should contain a base64-encoded string of the file’s content
    const base64 = uri.query; // e.g. "Ym9keSB7CiAgIC8vIFNvbWUgamF2YXNjcmlwdCBjb2RlCn0="
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return decoded;
  }
}
