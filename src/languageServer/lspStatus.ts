import path from 'path';

import { SingletonLogger } from '../utilities/Singleton-logger';
import { LanguageFeaturesService } from './languageFeaturesService';
import { getActiveRepo } from '../utilities/contextManager';

// Cached value; undefined means “not checked yet”
let _lspReady: boolean | undefined;
let _inFlight: Promise<boolean> | null = null;

/**
 * Cheap, cross-platform path containment check.
 */
function isUnder(childAbs: string, parentAbs: string): boolean {
  const rel = path.relative(parentAbs, childAbs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Public getter for the cached value (undefined until the first probe completes).
 */
export function getCachedLspReady(): boolean | undefined {
  return _lspReady;
}

/**
 * Check whether an LSP / workspace symbol provider is currently working
 * for the active repo. Can be called repeatedly:
 *  - Uses a cached result if available (unless force=true).
 *  - Only runs one probe at a time (_inFlight).
 *
 * Heuristic:
 *  - Run a few lightweight workspace symbol queries.
 *  - If any result resolves to a file under the active repo root, mark as true.
 *
 * Returns: boolean (cached once computed).
 */
export async function getIsLspReady(opts?: { force?: boolean }): Promise<boolean> {
  const extraQueries: string[] = [];

  if (!opts?.force && typeof _lspReady === 'boolean') return _lspReady;
  if (_inFlight && !opts?.force) return _inFlight;

  const logger = SingletonLogger.getInstance();
  const lfs = new LanguageFeaturesService();

  _inFlight = (async () => {
    try {
      const activeRepo = getActiveRepo();
      const root = activeRepo ? path.resolve(activeRepo) : null;
      if (!root) {
        _lspReady = false;
        return _lspReady;
      }

      // Keep the queries cheap and generic.
      const queries = [
        '', // some providers honor "" as "all symbols"
        'a',
        'e', // common letters catch lots of symbols quickly
        '_', // many codebases have underscored names
        'class',
        'func',
        ...extraQueries,
      ];

      const getSymbols = async (q: string) => {
        try {
          return await lfs.getWorkspaceSymbols(q);
        } catch {
          return [];
        }
      };

      let ready = false;
      for (const q of queries) {
        const syms = await getSymbols(q);
        for (const s of syms) {
          const fsPath = s?.location?.uri?.fsPath;
          if (fsPath && isUnder(path.resolve(fsPath), root)) {
            ready = true;
            break;
          }
        }
        if (ready) break;
      }

      _lspReady = ready;
      return _lspReady;
    } catch (err) {
      logger.error?.(`LSP readiness check failed: ${String(err)}`);
      _lspReady = false;
      return _lspReady;
    } finally {
      _inFlight = null;
    }
  })();

  return _inFlight;
}
