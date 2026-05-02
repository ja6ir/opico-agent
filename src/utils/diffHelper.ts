import * as Diff from "diff";

/**
 * Statistics about a file edit: how many lines were added and removed.
 */
export interface DiffStats {
  added: number;
  removed: number;
}

/**
 * Calculate the number of added and removed lines between two strings.
 * Uses the `diff` npm package to compute a structured line-level diff.
 *
 * @param oldContent - The original file content.
 * @param newContent - The modified file content.
 * @returns An object with `added` and `removed` line counts.
 */
export function calculateDiffStats(
  oldContent: string,
  newContent: string
): DiffStats {
  const changes = Diff.diffLines(oldContent, newContent);

  let added = 0;
  let removed = 0;

  for (const change of changes) {
    if (change.added) {
      added += change.count ?? 0;
    } else if (change.removed) {
      removed += change.count ?? 0;
    }
  }

  return { added, removed };
}

/**
 * Generate a unified diff string (like `git diff`) for display purposes.
 *
 * @param filePath - The path of the file being diffed (for the header).
 * @param oldContent - The original file content.
 * @param newContent - The modified file content.
 * @returns A unified diff string.
 */
export function generateUnifiedDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): string {
  return Diff.createPatch(filePath, oldContent, newContent, "original", "modified");
}
