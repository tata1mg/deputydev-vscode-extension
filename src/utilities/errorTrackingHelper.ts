/**
 * Truncate all values of an object to a maximum string length.
 * - Converts all values to strings, truncates at maxLen.
 * - Ignores inherited keys, only uses own string keys.
 * - Handles null, undefined, arrays, etc.
 */
export function truncatePayloadValues(obj: unknown, maxLen: number = 100): Record<string, string> {
  const result: Record<string, string> = {};

  // Only handle non-null objects (excluding arrays, functions, etc)
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const strValue = String(value);
      result[key] = strValue.length > maxLen ? strValue.slice(0, maxLen) : strValue;
    }
  } else {
    // Optionally handle the case where input isn't a plain object:
    // throw new Error("Input must be an object");
    // or just ignore
  }

  return result;
}
