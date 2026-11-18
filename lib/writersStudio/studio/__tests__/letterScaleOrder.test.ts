/**
 * Founder ruling 2026-11-17: macro-to-micro order of the letter's places is by SCALE ALONE (whole Work, part, chapter, section, passage),
 * and only when the writer asks for it; book order stays the default (ruling 3, 2026-11-11). MAIA ranks nothing: the order never reads
 * the band (begin-here / next / later / watch), and every place stays reachable.
 */
import { byScale, inBookOrder } from '@/lib/writersStudio/studio/editorialPassRunner';

const order = ['s1', 's2', 's3'];
const it = (id: string, scale: string, band: string, sectionId: string) => ({ id, scale, band, sectionIds: [sectionId] });
const ITEMS = [
  it('p3', 'passage', 'begin-here', 's1'),
  it('c2', 'chapter', 'watch', 's2'),
  it('w1', 'whole-work', 'later', 's3'),
  it('c1', 'chapter', 'later', 's1'),
  it('p1', 'passage', 'next', 's3'),
  it('x', 'section', 'next', 's2'),
];

describe('macro-to-micro by scale alone', () => {
  it('⭐ whole Work first, then part, chapter, section, passage; book order within each scale', () => {
    expect(byScale(ITEMS, order).map((x) => x.id)).toEqual(['w1', 'c1', 'c2', 'x', 'p3', 'p1']);
  });
  it('⭐ MUST FAIL IF the band (MAIA\'s sense of priority) changes the order: every band permutation gives the same order', () => {
    const bands = ['begin-here', 'next', 'later', 'watch'];
    const base = byScale(ITEMS, order).map((x) => x.id);
    for (let k = 0; k < bands.length; k += 1) {
      const rebanded = ITEMS.map((x, i) => ({ ...x, band: bands[(i + k) % bands.length]! }));
      expect(byScale(rebanded, order).map((x) => x.id)).toEqual(base);
    }
  });
  it('⭐ every place stays reachable: the same places, none added or lost', () => {
    expect(byScale(ITEMS, order).map((x) => x.id).sort()).toEqual(ITEMS.map((x) => x.id).sort());
  });
  it('an unknown scale goes last, in book order, never dropped', () => {
    const odd = [...ITEMS, it('u', 'cosmic', 'begin-here', 's1')];
    expect(byScale(odd, order).at(-1)!.id).toBe('u');
  });
  it('book order is unchanged and still the default order function', () => {
    expect(inBookOrder(ITEMS, order).map((x) => x.id)).toEqual(['p3', 'c1', 'c2', 'x', 'w1', 'p1']);
  });
});
