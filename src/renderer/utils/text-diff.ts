import * as Diff from 'diff';

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  changes: number;
  wordCount: number;
}

/**
 * Get word-level diff between original and modified text.
 * Returns array of diff parts with added/removed markers.
 */
export function getWordDiff(original: string, modified: string): DiffPart[] {
  return Diff.diffWords(original, modified);
}

/**
 * Get character-level diff (more granular).
 */
export function getCharDiff(original: string, modified: string): DiffPart[] {
  return Diff.diffChars(original, modified);
}

/**
 * Get line-level diff (for multi-line text).
 */
export function getLineDiff(original: string, modified: string): DiffPart[] {
  return Diff.diffLines(original, modified);
}

/**
 * Calculate statistics about the diff.
 */
export function getDiffStats(original: string, modified: string): DiffStats {
  const wordDiff = getWordDiff(original, modified);
  let additions = 0;
  let deletions = 0;
  let changes = 0;

  wordDiff.forEach((part) => {
    if (part.added) {
      additions += part.value.split(/\s+/).filter((w) => w).length;
      changes++;
    } else if (part.removed) {
      deletions += part.value.split(/\s+/).filter((w) => w).length;
      changes++;
    }
  });

  return {
    additions,
    deletions,
    changes,
    wordCount: modified.split(/\s+/).filter((w) => w).length,
  };
}

/**
 * Get simple change summary (backward compatible).
 */
export function getChangeSummary(original: string, modified: string): number {
  const stats = getDiffStats(original, modified);
  return stats.changes;
}
