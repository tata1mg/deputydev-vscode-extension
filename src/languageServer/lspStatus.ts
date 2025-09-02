import path from 'path';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { LanguageFeaturesService } from './languageFeaturesService';
import { getActiveRepo } from '../utilities/contextManager';

let _lspReady: boolean | undefined;
let _inFlight: Promise<boolean> | null = null;

function isUnder(childAbs: string, parentAbs: string): boolean {
  const rel = path.relative(parentAbs, childAbs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function getCachedLspReady(): boolean | undefined {
  return _lspReady;
}

export async function getIsLspReady(opts?: { force?: boolean }): Promise<boolean> {
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

      const queries = ['', 'a', 'e', '_', 'class', 'func'];

      const getSymbols = async (q: string) => {
        try {
          return await lfs.getWorkspaceSymbols(q);
        } catch {
          return [];
        }
      };

      // Run queries in parallel
      const tasks = queries.map(async (q) => {
        const syms = await getSymbols(q);
        return syms.some((s) => {
          const fsPath = s?.location?.uri?.fsPath;
          return fsPath && isUnder(path.resolve(fsPath), root);
        });
      });

      // Global timeout safeguard (max 10s)
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30000));

      const found = Promise.any(tasks).catch(() => false);

      _lspReady = await Promise.race([found, timeout]);
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
