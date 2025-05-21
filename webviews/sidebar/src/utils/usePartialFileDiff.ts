import { useMemo } from 'react';
import { parse, Allow } from 'partial-json';
import { logToOutput } from '@/commandApi';
/**
 * Hook that parses partial JSON and returns path, diff, and a complete flag.
 */
function usePartialFileDiff(content: string) {
  const { path, diff, complete } = useMemo(() => {
    try {
      const obj = parse(content, Allow.OBJ | Allow.STR) as {
        path?: string;
        diff?: string;
      };
      const isComplete = typeof obj.path === 'string' && typeof obj.diff === 'string';
      return { ...obj, complete: isComplete };
    } catch {
      return { path: undefined, diff: undefined, complete: false };
    }
  }, [content]);

  return { path, diff, complete };
}

export { usePartialFileDiff };
