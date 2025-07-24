function calculateDiffMetric(diff: string): number {
  const lines = diff.split('\n').length;

  const HEAD = /^[-]{3,} SEARCH\s*$/gm;
  const DIV = /^[=]{3,}\s*$/gm;
  const UPD = /^[+]{3,} REPLACE\s*$/gm;

  const freqA = (diff.match(HEAD) || []).length;
  const freqB = (diff.match(DIV) || []).length;
  const freqC = (diff.match(UPD) || []).length;

  return lines - (freqA + freqB + freqC);
}

export { calculateDiffMetric };
