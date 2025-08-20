import path from 'path';

import { LanguageFeaturesService } from '../../../languageServer/languageFeaturesService';
import { getContextRepositories } from '../../../utilities/contextManager';
import { fromFilePath, isUnder, toFilePath } from '../../../utilities/path';
import { SingletonLogger } from '../../../utilities/Singleton-logger';
import { extractSymbolInfo, findDefinitionAnchor, toLocationInfo } from './usages.helpers';
import { GetUsagesArgs, GetUsagesResult, SymbolInfo } from './usages.types';
import { throwToolError, ToolError } from '../utils/ToolError';

export class GetUsagesTool {
  private readonly logger: ReturnType<typeof SingletonLogger.getInstance>;
  private readonly languageFeaturesService: LanguageFeaturesService;

  /**
   * Keep default constructor for backward compatibility (ChatManager creates via `new GetUsagesTool()`).
   * Allow optional DI for testing or advanced wiring.
   */
  constructor(
    languageFeaturesService?: LanguageFeaturesService,
    logger?: ReturnType<typeof SingletonLogger.getInstance>,
  ) {
    this.logger = logger ?? SingletonLogger.getInstance();
    this.languageFeaturesService = languageFeaturesService ?? new LanguageFeaturesService();
  }

  /**
   * Find references/defs/implementations for `symbolName`.
   * Returns a typed result. On error, throws a standardized tool error.
   */
  public async getUsages(args: GetUsagesArgs): Promise<GetUsagesResult> {
    const { symbolName } = args;
    if (!symbolName || symbolName.trim().length === 0) {
      throwToolError('DDT401', 'INVALID_TOOL_PARAMS', 'symbolName is required and cannot be empty.');
    }

    try {
      // --- NEW: read context repositories and precompute allowed roots
      const contextRepos = (await getContextRepositories()) ?? [];
      const allowedRoots = contextRepos.map((r) => path.resolve(r.repo_path));

      // 1) Resolve candidate file paths (fallback to workspace symbol search)
      let filePaths = args.filePaths;

      if (!filePaths || filePaths.length === 0) {
        const wsSymbols = await this.languageFeaturesService.getWorkspaceSymbols(symbolName);

        // --- CHANGED: only keep symbols whose files are inside any context repo path
        const filtered = wsSymbols.filter((s) => {
          const abs = s.location.uri.fsPath; // absolute path for file:// URIs
          if (!abs) return false;
          const resolved = path.resolve(abs);
          return allowedRoots.length > 0 ? allowedRoots.some((root) => isUnder(resolved, root)) : false; // if no context repos, treat as no matches
        });

        filePaths = [...new Set(filtered.map((s) => toFilePath(s.location.uri)))];
      }

      if (!filePaths || filePaths.length === 0) {
        throwToolError('DDT402', 'SYMBOL_NOT_FOUND', `No files found via workspace symbols for "${symbolName}".`);
      }

      // 2) Find a concrete definition anchor (resilient: docSymbols -> workspaceSymbol location -> text scan + defs)
      const uris = (filePaths ?? []).map((fp) => fromFilePath(fp));
      const def = await findDefinitionAnchor(symbolName, uris);
      if (!def) {
        throwToolError(
          'DDT402',
          'SYMBOL_NOT_FOUND',
          `Symbol "${symbolName}" not found in provided or discovered files.`,
        );
      }

      // 3) Query defs/refs/impls at the definition position
      const [defs, refs, imps] = await Promise.all([
        this.languageFeaturesService.getDefinitions(def.uri, def.range.start),
        this.languageFeaturesService.getReferences(def.uri, def.range.start),
        this.languageFeaturesService.getImplementations(def.uri, def.range.start),
      ]);

      // Convert all buckets into wire-friendly shapes (ONLY line numbers)
      const defInfos = defs.map((x) => toLocationInfo(x));
      const refInfos = refs.map((x) => toLocationInfo(x));
      const impInfos = imps.map((x) => toLocationInfo(x));

      // 4) Try to enrich with symbol body (best-effort; ok to omit on failure)
      let symbolInfo: SymbolInfo | undefined = undefined;
      try {
        symbolInfo = await extractSymbolInfo(def, symbolName);
      } catch (e) {
        // Ignore errors from extractSymbolInfo
      }

      const result: GetUsagesResult = {
        symbol: symbolName,
        counts: {
          references: refs.length,
          definitions: defs.length,
          implementations: imps.length,
        },
        references: refInfos,
        definitions: defInfos,
        implementations: impInfos,
        ...(symbolInfo ? { symbolInfo } : {}),
      };
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      try {
        this.logger.error(`GetUsagesTool error: ${JSON.stringify(message)}`);
      } catch {
        // Ignore errors from logger
      }

      // ✅ If it's already a ToolError, just rethrow it
      if (e instanceof ToolError) {
        throw e;
      }

      // Else, wrap it.
      throwToolError('DDT500', 'SERVER_ERROR', message);
    }
  }
}
