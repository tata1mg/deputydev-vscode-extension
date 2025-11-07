import * as vscode from 'vscode';
import { absolutePathForUri } from '../../../utilities/path';
import { EnrichedDefinition, LocationInfo, SymbolInfo } from './usages.types';
import { LanguageFeaturesService } from '../../../languageServer/languageFeaturesService';

// -------------------------
// Helpers
// -------------------------

export function toLocationInfoAbs(loc: vscode.Location | vscode.LocationLink): LocationInfo {
  const { uri, range } = locParts(loc);
  const absPath = absolutePathForUri(uri);

  return {
    filePath: absPath, // ABSOLUTE on file:// URIs
    line: range.start.line, // ONLY line numbers
  };
}

export async function findDefinitionAnchor(
  symbolName: string,
  uris: vscode.Uri[],
): Promise<vscode.Location | undefined> {
  const languageFeaturesService = new LanguageFeaturesService();

  // A) Try DocumentSymbols in each file
  for (const uri of uris) {
    const symbols = await languageFeaturesService.getDocumentSymbols(uri);

    const flat = flattenDocSymbols(symbols);
    const hit = flat.find((s) => s.name === symbolName);

    if (hit) {
      const loc = new vscode.Location(uri, hit.selectionRange);
      return loc;
    }
  }

  // B) Use WorkspaceSymbol locations as anchors (often point at actual defs)
  const wsSymbols = await languageFeaturesService.getWorkspaceSymbols(symbolName);

  // Prefer locations that are in our candidate URIs (same file), but allow any matching symbol
  const byUri = new Set(uris.map((u) => u.toString()));
  const preferred = wsSymbols.filter((s) => byUri.has(s.location.uri.toString()));
  const pool = preferred.length ? preferred : wsSymbols;

  for (const s of pool) {
    if (s.name !== symbolName) continue;
    const loc = new vscode.Location(s.location.uri, s.location.range.start);
    return loc;
  }

  // C) Text-scan + definitionProvider: open file, find word matches, ask defs at each
  for (const uri of uris) {
    const doc = await vscode.workspace.openTextDocument(uri);
    const text = doc.getText();

    const re = new RegExp(`\\b${escapeRegExp(symbolName)}\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const midOffset = m.index + Math.floor(symbolName.length / 2);
      const pos = doc.positionAt(midOffset);

      const defs = await languageFeaturesService.getDefinitions(uri, pos);

      if (defs.length) {
        const first = defs[0] as vscode.Location | vscode.LocationLink;
        const { uri: defUri, range } = locParts(first);
        const anchor = new vscode.Location(defUri, range.start);
        return anchor;
      }
    }
  }

  return undefined;
}

export const SymbolKindMap: Record<vscode.SymbolKind, string> = {
  [vscode.SymbolKind.File]: 'File',
  [vscode.SymbolKind.Module]: 'Module',
  [vscode.SymbolKind.Namespace]: 'Namespace',
  [vscode.SymbolKind.Package]: 'Package',
  [vscode.SymbolKind.Class]: 'Class',
  [vscode.SymbolKind.Method]: 'Method',
  [vscode.SymbolKind.Property]: 'Property',
  [vscode.SymbolKind.Field]: 'Field',
  [vscode.SymbolKind.Constructor]: 'Constructor',
  [vscode.SymbolKind.Enum]: 'Enum',
  [vscode.SymbolKind.Interface]: 'Interface',
  [vscode.SymbolKind.Function]: 'Function',
  [vscode.SymbolKind.Variable]: 'Variable',
  [vscode.SymbolKind.Constant]: 'Constant',
  [vscode.SymbolKind.String]: 'String',
  [vscode.SymbolKind.Number]: 'Number',
  [vscode.SymbolKind.Boolean]: 'Boolean',
  [vscode.SymbolKind.Array]: 'Array',
  [vscode.SymbolKind.Object]: 'Object',
  [vscode.SymbolKind.Key]: 'Key',
  [vscode.SymbolKind.Null]: 'Null',
  [vscode.SymbolKind.EnumMember]: 'EnumMember',
  [vscode.SymbolKind.Struct]: 'Struct',
  [vscode.SymbolKind.Event]: 'Event',
  [vscode.SymbolKind.Operator]: 'Operator',
  [vscode.SymbolKind.TypeParameter]: 'TypeParameter',
};

/** Best-effort enrichment for symbol body/metadata. Safe to return undefined. */
export async function extractSymbolInfo(def: vscode.Location, symbolName: string): Promise<SymbolInfo | undefined> {
  // Try DocumentSymbols first (best)
  const languageFeaturesService = new LanguageFeaturesService();

  const docSymbols = await languageFeaturesService.getDocumentSymbols(def.uri);

  const flat = flattenDocSymbols(docSymbols);
  const owner = findInnermostContaining(flat, def.range.start);

  let fullStartLine: number | undefined;
  let fullEndLine: number | undefined;
  let selStartLine: number | undefined;
  let name = symbolName;
  let kind: string = 'Function'; // default-ish
  let code: string | undefined;

  if (owner) {
    name = owner.name || symbolName;
    kind = SymbolKindMap[owner.kind] ?? 'Unknown';

    fullStartLine = owner.range.start.line;
    fullEndLine = owner.range.end.line;
    selStartLine = owner.selectionRange.start.line;

    // Extract body text (full range lines)
    try {
      const doc = await vscode.workspace.openTextDocument(def.uri);
      const text = getTextByFullLines(doc, fullStartLine, fullEndLine);
      code = text;
    } catch (e) {
      // Ignore errors from getTextByFullLines
    }
  } else {
    // Fallback: selection range provider (may give a larger structural range around the point)
    try {
      const sels = await vscode.commands.executeCommand<vscode.SelectionRange[] | undefined>(
        'vscode.executeSelectionRangeProvider',
        def.uri,
        [def.range.start],
      );

      const chosen = sels?.[0];
      if (chosen) {
        // Choose an outer parent if the immediate range is too tiny (same line)
        let s: vscode.SelectionRange | undefined = chosen;
        let best: vscode.SelectionRange = s;
        while (s?.parent) {
          if (s.range.end.line > s.range.start.line) {
            best = s; // prefer a multi-line range
          }
          s = s.parent;
        }

        fullStartLine = best.range.start.line;
        fullEndLine = best.range.end.line;
        selStartLine = def.range.start.line;

        const doc = await vscode.workspace.openTextDocument(def.uri);
        const text = fullEndLine > fullStartLine ? getTextByFullLines(doc, fullStartLine, fullEndLine) : undefined;

        code = text;
      }
    } catch (e) {
      // Ignore errors from getTextByFullLines
    }
  }

  if (fullStartLine === undefined || fullEndLine === undefined) {
    return undefined;
  }

  const info: SymbolInfo = {
    name,
    kind,
    filePath: absolutePathForUri(def.uri),
    selectionLine: selStartLine ?? def.range.start.line,
    fullRange: {
      start: fullStartLine,
      end: fullEndLine,
    },
    ...(code ? { code } : {}),
  };

  return info;
}

export function flattenDocSymbols(nodes: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  const out: vscode.DocumentSymbol[] = [];
  const walk = (arr: vscode.DocumentSymbol[]) => {
    for (const s of arr) {
      out.push(s);
      if (s.children?.length) walk(s.children);
    }
  };
  walk(nodes || []);
  return out;
}

export function findInnermostContaining(
  nodes: vscode.DocumentSymbol[],
  pos: vscode.Position,
): vscode.DocumentSymbol | undefined {
  let winner: vscode.DocumentSymbol | undefined;
  for (const n of nodes) {
    if (n.range.contains(pos)) {
      // prefer the smallest containing range
      if (!winner || n.range.end.line - n.range.start.line < winner.range.end.line - winner.range.start.line) {
        winner = n;
      }
    }
  }
  return winner;
}

export function getTextByFullLines(doc: vscode.TextDocument, startLine: number, endLine: number): string {
  const start = new vscode.Position(startLine, 0);
  const end = doc.lineAt(endLine).range.end; // include entire end line
  return doc.getText(new vscode.Range(start, end));
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function locParts(loc: vscode.Location | vscode.LocationLink): { uri: vscode.Uri; range: vscode.Range } {
  if (loc instanceof vscode.Location) {
    return { uri: loc.uri, range: loc.range };
  }
  const range = loc.targetSelectionRange ?? loc.targetRange;
  return { uri: loc.targetUri, range };
}

export async function toLocationInfo(loc: vscode.Location | vscode.LocationLink): Promise<LocationInfo> {
  const { uri, range } = locParts(loc);
  return await toLocationInfoFromParts(uri, range);
}

export async function toLocationInfoFromParts(uri: vscode.Uri, range: vscode.Range): Promise<LocationInfo> {
  const absPath = absolutePathForUri(uri);
  const lineNum = range.start.line;

  let snippet: string | undefined;
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const lineText = doc.lineAt(lineNum).text.trim();
    snippet = lineText.length > 200 ? lineText.slice(0, 197) + '...' : lineText;
  } catch {
    // ignore errors (e.g. file not found, closed, or binary)
  }

  return {
    filePath: absPath,
    line: lineNum,
    ...(snippet ? { snippet } : {}),
  };
}

export function pickBestSelectionRange(root?: vscode.SelectionRange): vscode.SelectionRange | undefined {
  if (!root) return undefined;
  let best = root;
  let cur: vscode.SelectionRange | undefined = root;
  while (cur?.parent) {
    // prefer a multi-line parent if available
    if (cur.parent.range.end.line > cur.parent.range.start.line) best = cur.parent;
    cur = cur.parent;
  }
  return best;
}

export function makeDefinitionFromLines(
  doc: vscode.TextDocument,
  absPath: string,
  selectionLine: number,
  startLine: number,
  endLine: number,
  maxLines: number,
): EnrichedDefinition {
  const total = endLine - startLine + 1;
  let code: string | undefined;
  let truncated = false;
  let omittedLineCount = 0;

  if (total > maxLines) {
    const half = Math.floor(maxLines / 2);
    const head = sliceLines(doc, startLine, startLine + half - 1);
    const tail = sliceLines(doc, endLine - half + 1, endLine);
    omittedLineCount = total - (head.split('\n').length + tail.split('\n').length);
    code = `${head}\n...omitted ${omittedLineCount} lines...\n${tail}`;
    truncated = true;
  } else {
    code = sliceLines(doc, startLine, endLine);
  }

  return {
    filePath: absPath,
    selectionLine,
    fullRange: { start: startLine, end: endLine },
    code,
    truncated,
    ...(omittedLineCount ? { omittedLineCount } : {}),
  };
}

export async function buildDefinitionFromOwner(
  tgtDoc: vscode.TextDocument,
  owner: vscode.DocumentSymbol,
  absPath: string,
  maxLines: number,
): Promise<EnrichedDefinition> {
  const selectionLine = owner.selectionRange.start.line;
  const startLine = owner.range.start.line;
  const endLine = owner.range.end.line;

  const def = makeDefinitionFromLines(tgtDoc, absPath, selectionLine, startLine, endLine, maxLines);
  return def;
}

export function sliceLines(doc: vscode.TextDocument, startLine: number, endLine: number): string {
  const start = new vscode.Position(startLine, 0);
  const end = doc.lineAt(endLine).range.end;
  return doc.getText(new vscode.Range(start, end));
}

export function isImportishLine(line: string): boolean {
  const kws = ['import', 'from', 'require', 'using', 'use', 'include', '#include', 'package', 'module', 'export'];
  return kws.some((k) => line.includes(k));
}
