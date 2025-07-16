import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as os from 'os';

const LOCK_RETRY_MS = 1000; // retry every 1 second
const LOCK_STALE_MS = 10 * 60_000; // consider stale after 10 minutes

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0); // throws if not alive
    return true;
  } catch {
    return false;
  }
}

interface LockFileData {
  pid: number;
  timestamp: number;
  hostname: string;
}

async function readLockFile(lockPath: string): Promise<LockFileData | null> {
  try {
    const content = await fsp.readFile(lockPath, 'utf-8');
    return JSON.parse(content) as LockFileData;
  } catch {
    return null;
  }
}

async function writeLockFile(lockPath: string): Promise<fs.promises.FileHandle> {
  const lockData: LockFileData = {
    pid: process.pid,
    timestamp: Date.now(),
    hostname: os.hostname(),
  };
  // Write with exclusive flag
  const handle = await fsp.open(lockPath, 'wx');
  await handle.writeFile(JSON.stringify(lockData));
  await handle.sync();
  return handle;
}

export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  let handle: fs.promises.FileHandle | null = null;

  // Try to acquire the lock
  while (!handle) {
    try {
      handle = await writeLockFile(lockPath);
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;

      // If lock file exists, read it
      const lockData = await readLockFile(lockPath);

      let isStale = false;
      if (lockData) {
        const age = Date.now() - lockData.timestamp;
        if (age > LOCK_STALE_MS) {
          isStale = true;
        } else if (!(await isProcessAlive(lockData.pid))) {
          isStale = true;
        }
      } else {
        // corrupt or unreadable lock, treat as stale
        isStale = true;
      }

      if (isStale) {
        await fsp.unlink(lockPath).catch(() => {});
      } else {
        await sleep(LOCK_RETRY_MS);
      }
    }
  }

  try {
    return await fn();
  } finally {
    await handle.close();
    await fsp.unlink(lockPath).catch(() => {});
  }
}
