/**
 * Optional: use the `diff` package for change highlighting.
 * Example: import * as Diff from 'diff'; Diff.diffWords(original, modified);
 */
export function getChangeSummary(original: string, modified: string): number {
  if (original === modified) return 0;
  const o = original.trim().split(/\s+/);
  const m = modified.trim().split(/\s+/);
  let changes = 0;
  const max = Math.max(o.length, m.length);
  for (let i = 0; i < max; i++) {
    if (o[i] !== m[i]) changes++;
  }
  return changes;
}
