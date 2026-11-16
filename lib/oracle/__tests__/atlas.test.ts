/**
 * Divination Atlas content model — Runes and Tarot.
 *
 * Pinned properties:
 *   - all 24 runes and all 78 cards resolve an entry; unknown ids resolve null
 *   - layers run from strongest evidence to weakest (never a modern layer above an older one)
 *   - every rune entry starts with the attested futhark layer and the reconstructed name
 *   - rune poems / myth appear only for sourced exemplars (Ansuz), never invented
 *   - every contemporary layer says its wording's source is not yet recorded
 *   - Tarot: 22 trumps, four suits of 14, and the Strength/Justice note only on those cards
 */
import { describe, it, expect } from '@jest/globals';
import { EVIDENCE } from '../atlas/evidence';
import { getRuneAtlasEntry, listRunes, RUNE_HISTORY } from '../atlas/runes';
import { ALL_CARDS, getTarotAtlasEntry, listCards, TAROT_HISTORY } from '../atlas/tarot';

const strengths = (layers: { evidence: keyof typeof EVIDENCE }[]) => layers.map((l) => EVIDENCE[l.evidence].strength);
const nonIncreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x <= xs[i - 1]);

describe('Rune Atlas', () => {
  it('lists 24 runes in three ættir of eight', () => {
    const runes = listRunes();
    expect(runes).toHaveLength(24);
    expect([1, 2, 3].map((a) => runes.filter((r) => r.aett === a).length)).toEqual([8, 8, 8]);
    expect(runes.map((r) => r.transliteration).slice(0, 6).join('')).toBe('fuþark');
  });

  it('resolves every rune; unknown slugs are null', () => {
    for (const r of listRunes()) expect(getRuneAtlasEntry(r.slug)).not.toBeNull();
    expect(getRuneAtlasEntry('not-a-rune')).toBeNull();
  });

  it('orders layers from strongest to weakest evidence and starts with inscriptions and name', () => {
    for (const r of listRunes()) {
      const e = getRuneAtlasEntry(r.slug)!;
      expect(e.layers[0].id).toBe('inscriptions');
      expect(e.layers[1].id).toBe('name');
      expect(nonIncreasing(strengths(e.layers))).toBe(true);
    }
  });

  it('shows rune poems and myth only for sourced exemplars', () => {
    const ansuz = getRuneAtlasEntry('ansuz')!;
    expect(ansuz.hasExemplarLayers).toBe(true);
    expect(ansuz.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['poems', 'myth']));
    const fehu = getRuneAtlasEntry('fehu')!;
    expect(fehu.hasExemplarLayers).toBe(false);
    expect(fehu.layers.map((l) => l.id)).not.toEqual(expect.arrayContaining(['poems']));
  });

  it('labels every contemporary layer as unsourced wording', () => {
    for (const r of listRunes()) {
      for (const l of getRuneAtlasEntry(r.slug)!.layers.filter((x) => x.evidence === 'contemporary')) {
        expect(l.source).toMatch(/not yet recorded/);
      }
    }
  });

  it('history is oldest first', () => {
    expect(RUNE_HISTORY[0].period).toBe('98 CE');
  });
});

describe('Tarot Atlas', () => {
  it('has 22 trumps and four suits of 14', () => {
    const { majors, suits } = listCards();
    expect(majors).toHaveLength(22);
    expect(suits.map((s) => s.cards.length)).toEqual([14, 14, 14, 14]);
    expect(ALL_CARDS).toHaveLength(78);
  });

  it('resolves every card with layers ordered strongest first', () => {
    for (const c of ALL_CARDS) {
      const e = getTarotAtlasEntry(c.id)!;
      expect(e).not.toBeNull();
      expect(e.layers[0].id).toBe('deck');
      expect(nonIncreasing(strengths(e.layers))).toBe(true);
    }
    expect(getTarotAtlasEntry('nope')).toBeNull();
  });

  it('notes the Strength/Justice swap only on those two cards', () => {
    for (const c of ALL_CARDS) {
      const body = getTarotAtlasEntry(c.id)!.layers[0].body;
      const mentions = body.includes('swaps Strength');
      expect(mentions).toBe(c.name === 'Strength' || c.name === 'Justice');
    }
  });

  it('labels every contemporary layer as unsourced wording', () => {
    for (const c of ALL_CARDS) {
      for (const l of getTarotAtlasEntry(c.id)!.layers.filter((x) => x.evidence === 'contemporary')) {
        expect(l.source).toMatch(/not yet recorded/);
      }
    }
  });

  it('history is oldest first', () => {
    expect(TAROT_HISTORY[0].title).toBe('Carte da trionfi');
  });
});
