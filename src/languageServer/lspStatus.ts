import path from 'path';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { LanguageFeaturesService } from './languageFeaturesService';
// Store LSP readiness state per repo
const _lspReadyByRepo = new Map<string, boolean>();
const _inFlightByRepo = new Map<string, Promise<boolean>>();

function isUnder(childAbs: string, parentAbs: string): boolean {
  const rel = path.relative(parentAbs, childAbs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function getCachedLspReady(repoPath: string): boolean | undefined {
  if (!repoPath) return undefined;
  const absRepo = path.resolve(repoPath);
  return _lspReadyByRepo.get(absRepo);
}

export async function getIsLspReady(opts: { force?: boolean; repoPath: string }): Promise<boolean> {
  const repoPath = opts.repoPath;
  const root = repoPath ? path.resolve(repoPath) : null;
  if (!root) {
    _lspReadyByRepo.set('unknown', false);
    return false;
  }

  // Check existing cache
  if (!opts.force && _lspReadyByRepo.has(root)) {
    return _lspReadyByRepo.get(root)!;
  }

  // Avoid duplicate in-flight checks per repo
  if (_inFlightByRepo.has(root) && !opts.force) {
    return _inFlightByRepo.get(root)!;
  }

  const logger = SingletonLogger.getInstance();
  const lfs = new LanguageFeaturesService();

  const inFlight = (async () => {
    try {
      const queries = ['', 'a', 'e', '_', 'class', 'func'];

      const getSymbols = async (q: string) => {
        try {
          return await lfs.getWorkspaceSymbols(q);
        } catch {
          return [];
        }
      };

      const tasks = queries.map(async (q) => {
        const syms = await getSymbols(q);
        return syms.some((s) => {
          const fsPath = s?.location?.uri?.fsPath;
          return fsPath && isUnder(path.resolve(fsPath), root);
        });
      });

      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30000));

      const found = Promise.any(tasks).catch(() => false);

      const result = await Promise.race([found, timeout]);
      _lspReadyByRepo.set(root, result);
      return result;
    } catch (err) {
      logger.error(`LSP readiness check failed for ${root}: ${String(err)}`);
      _lspReadyByRepo.set(root, false);
      return false;
    } finally {
      _inFlightByRepo.delete(root);
    }
  })();

  _inFlightByRepo.set(root, inFlight);
  return inFlight;
}
