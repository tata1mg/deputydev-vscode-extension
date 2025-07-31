function calculateDiffMetric(diff: string): number {
  const lines = countLines(diff);

  const HEAD = /^[-]{3,} SEARCH\s*$/gm;
  const DIV = /^[=]{3,}\s*$/gm;
  const UPD = /^[+]{3,} REPLACE\s*$/gm;

  const freqA = (diff.match(HEAD) || []).length;
  const freqB = (diff.match(DIV) || []).length;
  const freqC = (diff.match(UPD) || []).length;

  return lines - (freqA + freqB + freqC);
}

function countLines(text: string): number {
  if (text.trim() === '') return 0; // handle completely empty strings
  // Normalize all line endings to '\n', split, and remove last line if empty (trailing newline)
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  // If the last element is an empty string (trailing newline), don't count it
  if (lines[lines.length - 1] === '') {
    return lines.length - 1;
  }
  return lines.length;
}

export { calculateDiffMetric };
