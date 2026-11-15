/**
 * Divination spread and casting fidelity.
 *
 * Pinned properties:
 *   - every Tarot spread the Tarot chamber offers returns that spread's card count
 *     (previously: the route passed the display name to a key lookup and threw)
 *   - every Rune spread the Runes chamber offers returns that spread's rune count
 *     (previously: Elemental Cross and Week Ahead silently fell back to a single rune)
 *   - Elemental Cross and Week Ahead return exactly the position names the UI shows
 *   - Single and Norns return the backend's position names, which DIFFER from the
 *     UI's ('Answer'; 'Past (Urd)' …). That divergence predates this change and is
 *     pinned here as current behaviour, not as UI agreement.
 *   - the library's yarrow-stalk line odds are 1/16, 5/16, 7/16, 3/16
 *   - the I Ching chamber page uses the library's yarrow caster, not equal odds
 *
 * Hermetic: the casting libraries are real; no network, no database.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { SPREADS as TAROT_SPREADS } from '@/lib/divination/tarot/spreads';
import { castYarrowLine } from '@/lib/divination/iching/casting';
import { POST as tarotPOST } from '../tarot/route';
import { POST as runesPOST } from '../runes/route';

function post(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Spread IDs offered by app/oracle/tarot/page.tsx (incl. the featured Spiralogic Draw)
const TAROT_PAGE_IDS = [
  'single', 'three-card', 'mind-body-spirit', 'elemental', 'spiralogic', 'relationship',
  'decision', 'chakra', 'shadow-work', 'career', 'celtic-cross', 'year-ahead',
];

// Spreads offered by app/oracle/runes/page.tsx. `matchesUi` marks where the
// backend labels equal the UI's labels; elsewhere `positions` pins the backend's
// current labels (UI shows 'Answer' and 'Past (Urd)' / 'Present (Verdandi)' /
// 'Future (Skuld)' — a pre-existing divergence, not fixed here).
const RUNE_PAGE_SPREADS: Array<{ id: string; matchesUi: boolean; positions: string[] }> = [
  { id: 'single', matchesUi: false, positions: ['The Rune'] },
  { id: 'norns', matchesUi: false, positions: ['Urd (Past)', 'Verdandi (Present)', 'Skuld (Future)'] },
  {
    id: 'elements',
    matchesUi: true,
    positions: ['Earth (Foundation)', 'Air (Mind)', 'Fire (Action)', 'Water (Emotion)', 'Spirit (Higher Self)'],
  },
  {
    id: 'week',
    matchesUi: true,
    positions: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
];

describe('Tarot route — every offered spread draws its own layout', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});

  it.each(TAROT_PAGE_IDS)('%s', async (id) => {
    const res = await tarotPOST(post('http://localhost/api/oracle/tarot', { query: 'test question', spreadType: id }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { reading: { drawnCards: unknown[]; spread: { cardCount: number } } };
    const expected = id === 'three-card' ? 3 : TAROT_SPREADS[id].cardCount;
    expect(json.reading.drawnCards).toHaveLength(expected);
    expect(json.reading.spread.cardCount).toBe(expected);
  });
});

describe('Rune route — every offered spread casts its own layout', () => {
  it.each(RUNE_PAGE_SPREADS)('$id (labels match UI: $matchesUi)', async ({ id, positions }) => {
    const res = await runesPOST(post('http://localhost/api/oracle/runes', { query: 'test question', spreadType: id }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { reading: { drawnRunes: Array<{ position: string }> } };
    expect(json.reading.drawnRunes.map((r) => r.position)).toEqual(positions);
  });
});

describe('I Ching yarrow-stalk odds', () => {
  it('library caster matches 1/16, 5/16, 7/16, 3/16', () => {
    const spy = jest.spyOn(Math, 'random');
    const at = (r: number) => {
      spy.mockReturnValueOnce(r);
      return castYarrowLine();
    };
    // Boundaries of each band
    expect(at(0)).toBe(6);
    expect(at(1 / 16 - 1e-9)).toBe(6);
    expect(at(1 / 16)).toBe(7);
    expect(at(6 / 16 - 1e-9)).toBe(7);
    expect(at(6 / 16)).toBe(8);
    expect(at(13 / 16 - 1e-9)).toBe(8);
    expect(at(13 / 16)).toBe(9);
    expect(at(1 - 1e-9)).toBe(9);
    spy.mockRestore();
  });

  it('I Ching chamber page uses the library caster, not equal odds', () => {
    const src = readFileSync(join(process.cwd(), 'app/oracle/iching/page.tsx'), 'utf8');
    expect(src).toContain('castYarrowLine()');
    expect(src).not.toMatch(/Math\.floor\(Math\.random\(\) \* 4\) \+ 6/);
  });
});
