/**
 * Rows for drawing a hexagram on screen.
 *
 * Hexagram data lists lines bottom to top: index 0 is line 1, index 5 is
 * line 6. A hexagram is read and drawn from the top down, so the first row
 * on screen must be line 6. Each row carries its own position so the
 * changing-line marker can never disagree with the line it sits beside.
 */
export interface HexagramRow<L> {
  /** Traditional line position, 1 (bottom) to 6 (top). */
  position: number;
  line: L;
  changing: boolean;
}

export function hexagramRowsTopDown<L>(
  linesBottomToTop: readonly L[],
  changingLines: readonly number[] = [],
): HexagramRow<L>[] {
  return linesBottomToTop
    .map((line, i) => ({ position: i + 1, line, changing: changingLines.includes(i + 1) }))
    .reverse();
}
