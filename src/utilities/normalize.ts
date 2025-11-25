/**
 * Normalize incoming search_terms so they are always:
 *   - undefined, OR
 *   - string[]
 *
 * Handles cases:
 *   - stringified array: "[\"auth\",\"oauth\"]"
 *   - single string: "auth"
 *   - already array: ["auth", "oauth"]
 *   - invalid input: return undefined
 */
export function normalizeSearchTerms(input: any): string[] | undefined {
  if (!input) return undefined;

  // Case 1: Already an array
  if (Array.isArray(input)) {
    const allStrings = input.every((i) => typeof i === 'string');
    return allStrings ? input : undefined;
  }

  // Case 2: String or stringified array
  if (typeof input === 'string') {
    // Try to parse if it's a JSON array string
    const trimmed = input.trim();

    // Looks like a JSON array string
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.every((i) => typeof i === 'string')) {
          return parsed;
        }
        return undefined;
      } catch {
        return undefined;
      }
    }

    // Normal string → wrap it
    return [input];
  }

  // Case 3: Everything else → ignore
  return undefined;
}
