import path from 'path';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { LanguageFeaturesService } from './languageFeaturesService';
// Store LSP readiness state per repo
const _lspReadyByRepo = new Map<string, boolean>();
const _inFlightByRepo = new Map<string, Promise<boolean>>();

function isUnder(childAbs: string, parentAbs: string): boolean {
  const normChild = path.resolve(childAbs);
  const normParent = path.resolve(parentAbs);
  const rel = path.relative(normParent, normChild);
  const result = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  return result;
}

/**
 * Resolve as soon as any promise resolves to a truthy boolean.
 * Resolves to false only if all promises settle without any truthy value.
 */
async function firstTrue(promises: Promise<boolean>[]): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let remaining = promises.length;

    for (const p of promises) {
      p.then((val) => {
        if (val && !done) {
          done = true;
          resolve(true);
        } else if (--remaining === 0 && !done) {
          resolve(false);
        }
      }).catch(() => {
        if (--remaining === 0 && !done) {
          resolve(false);
        }
      });
    }
  });
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

        const hasSymbolInRepo = syms.some((s: any) => {
          const fsPath: string | undefined = s?.location?.uri?.path ?? s?.location?.uri?.fsPath;

          if (!fsPath) {
            return false;
          }

          const ok = isUnder(path.resolve(fsPath), root);
          return ok;
        });
        return hasSymbolInRepo;
      });
      const timeout = new Promise<boolean>((resolve) =>
        setTimeout(() => {
          resolve(false);
        }, 30000),
      );

      // Short-circuit as soon as any task returns true; still race with timeout.
      const found = firstTrue(tasks);
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
