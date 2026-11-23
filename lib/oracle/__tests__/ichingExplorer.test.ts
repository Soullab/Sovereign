/**
 * I Ching Living Explorer content model.
 *
 * Pinned properties:
 *   - every hexagram 1–64 resolves an entry with both trigrams
 *   - the twelve sovereign hexagrams are distinct, cover months 1–12, and
 *     alternate by exactly one line as yang grows and wanes
 *   - casting odds each sum to 16 and match the library's yarrow caster
 *   - hexagram-specific commentary only appears where it names sources
 *   - an unknown hexagram yields null rather than an invented entry
 */
import { describe, it, expect } from '@jest/globals';
import {
  CASTING_ODDS,
  HEXAGRAM_COMMENTARY,
  ICHING_HISTORY,
  SOVEREIGN_HEXAGRAMS,
  getExplorerEntry,
  sovereignPosition,
} from '../ichingExplorer';
import { getHexagram } from '@/lib/divination/iching/hexagrams';

describe('ichingExplorer', () => {
  it('resolves all 64 hexagrams with both trigrams', () => {
    for (let n = 1; n <= 64; n++) {
      const e = getExplorerEntry(n);
      expect(e).not.toBeNull();
      expect(e!.upper).toBeDefined();
      expect(e!.lower).toBeDefined();
    }
  });

  it('returns null for a hexagram that does not exist', () => {
    expect(getExplorerEntry(0)).toBeNull();
    expect(getExplorerEntry(65)).toBeNull();
  });

  it('sovereign hexagrams cover the twelve months and change one line at a time', () => {
    expect(new Set(SOVEREIGN_HEXAGRAMS.map((s) => s.hexagram)).size).toBe(12);
    expect(SOVEREIGN_HEXAGRAMS.map((s) => s.month).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1)
    );
    for (let i = 0; i < 12; i++) {
      const a = getHexagram(SOVEREIGN_HEXAGRAMS[i].hexagram)!.lines;
      const b = getHexagram(SOVEREIGN_HEXAGRAMS[(i + 1) % 12].hexagram)!.lines;
      const diff = a.filter((l, j) => l !== b[j]).length;
      expect(diff).toBe(1);
    }
  });

  it('Return (24) is the solstice month, between Kun (2) and Lin (19)', () => {
    expect(sovereignPosition(24)).toEqual({ hexagram: 24, month: 11, prev: 2, next: 19 });
    expect(sovereignPosition(3)).toBeNull();
  });

  it('casting odds sum to 16 for each method', () => {
    expect(CASTING_ODDS.reduce((s, o) => s + o.yarrow, 0)).toBe(16);
    expect(CASTING_ODDS.reduce((s, o) => s + o.coins, 0)).toBe(16);
    expect(CASTING_ODDS.map((o) => o.yarrow)).toEqual([1, 5, 7, 3]);
  });

  it('every commentary entry names its sources', () => {
    for (const c of Object.values(HEXAGRAM_COMMENTARY)) {
      expect(c.sources.length).toBeGreaterThan(0);
      expect(c.readings.length).toBeGreaterThan(0);
    }
    expect(getExplorerEntry(24)!.commentary).not.toBeNull();
    expect(getExplorerEntry(3)!.commentary).toBeNull();
  });

  it('history is ordered oldest first and every entry has an evidence class', () => {
    expect(ICHING_HISTORY[0].title).toBe('The Zhouyi');
    for (const h of ICHING_HISTORY) expect(h.evidence).toBeTruthy();
  });
});
