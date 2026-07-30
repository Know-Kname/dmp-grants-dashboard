/**
 * Tiny fuzzy scorer for the command palette — no dependency needed.
 *
 * Case-insensitive subsequence match: every character of the query must
 * appear in order in the text. Scoring favors word-boundary hits and
 * consecutive runs, and penalizes gaps, so "wo" ranks "Work Orders" above
 * "Two-year contract". Returns null when the query doesn't match.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;

  // Exact substring beats any scattered subsequence; earlier is better.
  const sub = t.indexOf(q);
  if (sub !== -1) {
    return 100 - sub + (sub === 0 || /[\s\-_/]/.test(t[sub - 1]) ? 20 : 0);
  }

  let score = 0;
  let ti = 0;
  let prevMatch = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return null;
    if (found === 0 || /[\s\-_/]/.test(t[found - 1])) score += 3; // word start
    if (found === prevMatch + 1) score += 2; // consecutive run
    score -= (found - ti) * 0.05; // gap penalty
    prevMatch = found;
    ti = found + 1;
  }
  return score;
}
