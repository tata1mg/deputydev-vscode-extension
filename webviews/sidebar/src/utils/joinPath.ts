// Helper to join paths for browser JS
export function joinPath(a?: string, b?: string) {
  if (!a) return b ?? '';
  if (!b) return a;
  if (a.endsWith('/') || a.endsWith('\\')) return a + b;
  return a + '/' + b;
}
