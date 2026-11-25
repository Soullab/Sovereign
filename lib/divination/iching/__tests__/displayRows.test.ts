/**
 * Founder walk 2026-11-25 (production, /oracle/iching): Hexagram 43 was drawn
 * with its broken line at the bottom — upside down, so it read as 44 — while
 * the changing-line markers sat at the top. The drawing must put line 6 first.
 */
import { describe, it, expect } from '@jest/globals';
import { hexagramRowsTopDown } from '../displayRows';
import { HEXAGRAMS } from '../hexagrams';

describe('hexagramRowsTopDown', () => {
  it('draws Hexagram 43 with its single yin line on top', () => {
    const h43 = HEXAGRAMS.find((h) => h.number === 43)!;
    const rows = hexagramRowsTopDown(h43.lines, [4, 5, 6]);
    expect(rows.map((r) => r.line)).toEqual(['yin', 'yang', 'yang', 'yang', 'yang', 'yang']);
    expect(rows.map((r) => r.position)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('marks changing lines on the rows they belong to', () => {
    const rows = hexagramRowsTopDown(['a', 'b', 'c', 'd', 'e', 'f'], [4, 5, 6]);
    expect(rows.filter((r) => r.changing).map((r) => r.position)).toEqual([6, 5, 4]);
    expect(rows.slice(0, 3).every((r) => r.changing)).toBe(true);
  });

  it('never mutates the source lines', () => {
    const lines = ['yin', 'yang', 'yang', 'yang', 'yang', 'yang'] as const;
    hexagramRowsTopDown(lines);
    expect(lines[0]).toBe('yin');
  });
});
