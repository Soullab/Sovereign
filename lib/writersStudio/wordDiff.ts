/**
 * The Revision Mirror's comparison (College Essay, founder 2026-11-16): which words are only in an earlier version the writer
 * kept, which only in their current draft. Exact text differences between the writer's OWN versions — "My changes, not AI's".
 * ⛔ It never suggests, ranks, or rewrites anything. Pure; no I/O.
 */
export type DiffPart = { kind: 'same' | 'earlier' | 'current'; text: string };

/** Above this many word pairs the comparison is not attempted (it would be slow on a phone); the caller says so plainly. */
export const MAX_DIFF_CELLS = 4_000_000;

const words = (s: string) => s.split(/\s+/).filter(Boolean);

export function wordDiff(earlier: string, current: string): DiffPart[] | null {
  const a = words(earlier);
  const b = words(current);
  if (a.length * b.length > MAX_DIFF_CELLS) return null;
  // Longest common subsequence over words, then walk it.
  const n = a.length, m = b.length;
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], w: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += ` ${w}`; else out.push({ kind, text: w });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('same', a[i]!); i++; j++; }
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) { push('earlier', a[i]!); i++; }
    else { push('current', b[j]!); j++; }
  }
  while (i < n) push('earlier', a[i++]!);
  while (j < m) push('current', b[j++]!);
  return out;
}
