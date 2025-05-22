function calculateDiffMetric(diff: string): number {
  const lines = diff.split('\n').length;

  const freqA = (diff.match(/<<<<<<< SEARCH/g) || []).length;
  const freqB = (diff.match(/=======/g) || []).length;
  const freqC = (diff.match(/>>>>>>> REPLACE/g) || []).length;

  return lines - (freqA + freqB + freqC);
}

export { calculateDiffMetric };
