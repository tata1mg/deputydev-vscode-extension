import * as vscode from 'vscode';

import { LanguageFeaturesService } from '../../../languageServer/languageFeaturesService';
import { absolutePathForUri, fromFilePath } from '../../../utilities/path';
import { SingletonLogger } from '../../../utilities/Singleton-logger';
import {
  buildDefinitionFromOwner,
  escapeRegExp,
  findInnermostContaining,
  flattenDocSymbols,
  locParts,
  makeDefinitionFromLines,
  pickBestSelectionRange,
  sliceLines,
  SymbolKindMap,
  toLocationInfoFromParts,
} from './usages.helpers';
import {
  EnrichedDefinition,
  LocationInfo,
  ModulePreview,
  ResolveModuleArgs,
  ResolveModuleResult,
} from './usages.types';
import { throwToolError, ToolError } from '../utils/ToolError';

export class GetResolveModuleTool {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly languageFeaturesService: LanguageFeaturesService;
  /**
   * Keep default constructor for backward compatibility (ChatManager creates via `new GetUsagesTool()`).
   * Allow optional DI for testing or advanced wiring.
   */
  constructor(languageFeaturesService: LanguageFeaturesService) {
    this.logger = SingletonLogger.getInstance();
    this.languageFeaturesService = languageFeaturesService;
  }

  public async resolveModule(args: ResolveModuleArgs): Promise<ResolveModuleResult> {
    try {
      const { filePath, importName } = args;
      if (!filePath || !importName) {
        throwToolError('DDT401', 'INVALID_TOOL_PARAMS', 'Both filePath and importName are required.');
      }
      // Defaults / knobs (tweak if you like)
      const MAX_BODY_LINES = 400;
      const PREVIEW_HEAD_LINES = 80;
      const PREVIEW_TAIL_LINES = 80;

      // Normalize + open source
      const srcUri = fromFilePath(filePath);

      let srcDoc: vscode.TextDocument;
      try {
        srcDoc = await vscode.workspace.openTextDocument(srcUri);
      } catch (e) {
        throwToolError('DDT403', 'OPEN_FAILED', `Cannot open source file: ${srcUri.toString()}`);
      }

      // --- Find position(s) of importName in the source (language-agnostic scan) ---
      const importish = [
        'import',
        'from',
        'require',
        'using',
        'use',
        'include',
        '#include',
        'package',
        'module',
        'export',
      ];
      type Cand = { pos: vscode.Position; line: number; score: number };
      const srcText = srcDoc.getText();
      const re = new RegExp(`\\b${escapeRegExp(importName)}\\b`, 'g');
      const candidates: Cand[] = [];

      let m: RegExpExecArray | null;
      while ((m = re.exec(srcText))) {
        const centerOffset = m.index + Math.floor(importName.length / 2);
        const pos = srcDoc.positionAt(centerOffset);
        const line = pos.line;
        const lineText = srcDoc.lineAt(line).text;

        let score = 0;
        if (importish.some((kw) => lineText.includes(kw))) score += 3;
        if (/\(|\)/.test(lineText)) score += 2;
        const prev = srcText[m.index - 1] ?? '';
        const next = srcText[m.index + importName.length] ?? '';
        if (prev === ',' || prev === '(' || next === ',' || next === ')') score += 1;

        candidates.push({ pos, line, score });
      }

      candidates.sort((a, b) => b.score - a.score || a.line - b.line);

      // --- Probe LSP: pick first candidate that resolves to any locations ---
      let chosenPos: vscode.Position | undefined;
      let rawTargets: (vscode.Location | vscode.LocationLink)[] = [];

      for (const c of candidates) {
        try {
          const locs = await this.languageFeaturesService.resolveImport(srcUri, c.pos);
          if (locs && locs.length > 0) {
            chosenPos = c.pos;
            rawTargets = locs;
            break;
          }
        } catch (e) {
          // Ignore errors from resolveImport
        }
      }

      // --- Hover (enabled by default) ---
      const hoverTexts: string[] = [];
      const hoverPos = chosenPos ?? candidates[0]?.pos;
      if (hoverPos) {
        try {
          const hovers = await this.languageFeaturesService.getHover(srcUri, hoverPos);
          for (const h of hovers ?? []) {
            const contents = h.contents as (vscode.MarkdownString | vscode.MarkedString | string)[];
            for (const c of contents) {
              if (typeof c === 'string') hoverTexts.push(c);
              else if (c instanceof vscode.MarkdownString) hoverTexts.push(c.value);
              else if (typeof (c as any)?.value === 'string') hoverTexts.push((c as any).value);
              else hoverTexts.push(String(c));
            }
          }
        } catch (e) {
          // Ignore errors from getHover
        }
      }

      if (!chosenPos || rawTargets.length === 0) {
        return { moduleTargets: [], hoverTexts };
      }

      // --- Enforce all targets are file:// URIs ---
      for (const t of rawTargets) {
        const { uri } = locParts(t);
        if (uri.scheme !== 'file') {
          throwToolError('DDT404', 'NON_FILE_URI', `Cannot open non-file URI: ${uri.toString()}`);
        }
      }

      // --- Convert to absolute module targets (line = start of target range) ---
      const moduleTargets: LocationInfo[] = rawTargets.map((t) =>
        toLocationInfoFromParts(locParts(t).uri, locParts(t).range),
      );

      // --- For each target: try to extract a symbol body, otherwise a module preview ---
      const definitions: EnrichedDefinition[] = [];
      const modulePreviews: ModulePreview[] = [];

      for (const t of rawTargets) {
        const { uri: tgtUri, range: tgtRange } = locParts(t);
        const tgtAbs = absolutePathForUri(tgtUri);
        const tgtPos = tgtRange.start;

        // Open target document (throw on failure as requested)
        let tgtDoc: vscode.TextDocument;
        try {
          tgtDoc = await vscode.workspace.openTextDocument(tgtUri);
        } catch (e) {
          throwToolError(400, 'OPEN_FAILED', `Cannot open target file: ${tgtUri.toString()}`);
        }

        // Try DocumentSymbols first (best)
        let owner: vscode.DocumentSymbol | undefined;
        try {
          const symbols = await this.languageFeaturesService.getDocumentSymbols(tgtUri);
          owner = findInnermostContaining(flattenDocSymbols(symbols), tgtPos);
        } catch (e) {
          // Ignore errors from getDocumentSymbols
        }

        if (owner) {
          const def = await buildDefinitionFromOwner(tgtDoc, owner, tgtAbs, MAX_BODY_LINES);
          const kind = SymbolKindMap[owner.kind] ?? 'Unknown';
          definitions.push({ ...def, kind });
          continue;
        }

        // Fallback: selection ranges
        try {
          const sels = await vscode.commands.executeCommand<vscode.SelectionRange[] | undefined>(
            'vscode.executeSelectionRangeProvider',
            tgtUri,
            [tgtPos],
          );
          const chosen = pickBestSelectionRange(sels?.[0]);
          if (chosen && chosen.range.end.line > chosen.range.start.line) {
            const fullStart = chosen.range.start.line;
            const fullEnd = chosen.range.end.line;
            const selectionLine = tgtPos.line;

            const def: EnrichedDefinition = makeDefinitionFromLines(
              tgtDoc,
              tgtAbs,
              selectionLine,
              fullStart,
              fullEnd,
              MAX_BODY_LINES,
            );
            definitions.push(def);
            continue;
          }
        } catch (e) {
          // Ignore errors from getSelectionRange
        }

        // No symbol body: create a module preview
        const totalLines = tgtDoc.lineCount;
        const head = sliceLines(tgtDoc, 0, Math.min(PREVIEW_HEAD_LINES, totalLines - 1));
        const tailStart = Math.max(0, totalLines - PREVIEW_TAIL_LINES);
        const tail = tailStart > 0 ? sliceLines(tgtDoc, tailStart, totalLines - 1) : undefined;
        const truncated = totalLines > PREVIEW_HEAD_LINES + PREVIEW_TAIL_LINES;

        modulePreviews.push({
          filePath: tgtAbs,
          head,
          tail,
          totalLines,
          truncated,
        });
      }

      const result: ResolveModuleResult = {
        moduleTargets,
        hoverTexts,
        ...(definitions.length ? { definitions } : {}),
        ...(modulePreviews.length ? { modulePreviews } : {}),
      };
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      this.logger.error(`GetResolveModuleTool error: ${JSON.stringify(message)}`);

      if (e instanceof ToolError) {
        throw e;
      }

      throwToolError('DDT500', 'SERVER_ERROR', message);
    }
  }
}
