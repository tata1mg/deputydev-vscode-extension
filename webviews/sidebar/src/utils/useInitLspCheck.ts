import { useEffect } from 'react';
import { hitLspCheck } from '@/commandApi';

/**
 * Keeps running LSP checks forever:
 * - At 10s, 30s, and 60s initially
 * - Then every 60s indefinitely
 */
export function useInitLspCheck() {
  useEffect(() => {
    // Run initial checks at 10s, 30s, 60s
    const delays = [10, 30, 60];
    delays.forEach((delay) => {
      setTimeout(async () => {
        try {
          await hitLspCheck();
        } catch (err) {
          console.error('Error in initial LSP check:', err);
        }
      }, delay * 1000);
    });

    // Run periodic checks every 60s forever
    const intervalId = setInterval(async () => {
      try {
        await hitLspCheck();
      } catch (err) {
        console.error('Error in periodic LSP check:', err);
      }
    }, 60_000);

    // Clear interval on unmount
    return () => clearInterval(intervalId);
  }, []);
}
