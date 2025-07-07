import * as fs from 'fs';
import { promises as fsp } from 'fs';

const LOCK_RETRY_MS = 1000; // retry every 1 second
const LOCK_STALE_MS = 10 * 60_000; // consider stale after 10 minutes

export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const tryOpen = async (): Promise<fs.promises.FileHandle | null> => {
    try {
      return await fsp.open(lockPath, 'wx'); // Exclusive create
    } catch (err: any) {
      if (err.code === 'EEXIST') return null;
      throw err;
    }
  };

  let handle = await tryOpen();
  while (!handle) {
    try {
      const stat = await fsp.stat(lockPath);
      const age = Date.now() - stat.mtimeMs;
      if (age > LOCK_STALE_MS) {
        await fsp.unlink(lockPath).catch(() => {});
      }
    } catch {
      // ignore if stat or unlink fails
    }

    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    handle = await tryOpen();
  }

  try {
    return await fn();
  } finally {
    await handle.close();
    await fsp.unlink(lockPath).catch(() => {});
  }
}
