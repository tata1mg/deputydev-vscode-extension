import { useEffect } from 'react';
import { hitLspCheck, webviewInitialized } from '@/commandApi';
import { resetChatState } from './resetChatState';

/**
 * Initializes the webview, resets chat, and checks LSP status
 * at 10s, and 30s intervals until success or final attempt.
 */
export function useInitLspCheck() {
  useEffect(() => {
    webviewInitialized();

    // Reset chat after 1.5 seconds
    const resetTimer = setTimeout(() => {
      resetChatState();
    }, 1500);

    const runChecks = async () => {
      const delays = [10, 30, 60];
      for (const delay of delays) {
        await new Promise((res) => setTimeout(res, delay * 1000));
        const ok = await hitLspCheck();
        if (ok) break;
      }
    };

    runChecks();

    return () => clearTimeout(resetTimer);
  }, []);
}
