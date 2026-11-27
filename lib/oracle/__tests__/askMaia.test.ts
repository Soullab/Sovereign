/**
 * Ask MAIA from the Atlas — the draft message.
 *
 * Pinned properties:
 *   - the draft names the Atlas, the tradition and the symbol
 *   - an aspect carries its evidence label, so MAIA can keep layers apart
 *   - long Atlas text is clipped, never sent whole
 *   - openings are the member's own questions (first person / addressed to MAIA),
 *     never statements about what the symbol means for the member
 */
import { describe, it, expect } from '@jest/globals';
import {
  ASK_MAIA_BODY_LIMIT,
  ASK_MAIA_OPENINGS,
  buildAskMaiaContext,
  withOpening,
} from '../atlas/askMaia';
import { getRuneAtlasEntry } from '../atlas/runes';

describe('Ask MAIA draft', () => {
  it('names the Atlas, tradition and symbol', () => {
    const msg = buildAskMaiaContext({ tradition: 'I Ching', subject: 'Hexagram 8 · 比 Holding Together' });
    expect(msg).toBe('From the Divination Atlas — I Ching: Hexagram 8 · 比 Holding Together');
  });

  it('carries the aspect and its evidence label with the layer text', () => {
    const ansuz = getRuneAtlasEntry('ansuz')!;
    const layer = ansuz.layers[0];
    const msg = buildAskMaiaContext({
      tradition: 'Runes',
      subject: ansuz.name,
      aspect: layer.title,
      evidence: layer.evidence,
      body: layer.body,
    });
    expect(msg).toContain(`Aspect: ${layer.title} (evidence: `);
    expect(msg).toContain(layer.body);
  });

  it('clips long text', () => {
    const msg = buildAskMaiaContext({ tradition: 'Tarot', subject: 'Strength', body: 'x'.repeat(5000) });
    expect(msg.length).toBeLessThan(ASK_MAIA_BODY_LIMIT + 100);
    expect(msg.endsWith('…')).toBe(true);
  });

  it('openings are questions the member asks', () => {
    for (const o of ASK_MAIA_OPENINGS) {
      expect(o.line).toMatch(/^(Can you|Where|How|I'd like)/);
      expect(o.line).not.toMatch(/\byou are\b|\byour life\b/i);
    }
    expect(withOpening('ctx', 'Q?')).toBe('ctx\n\nQ?');
  });
});

describe('Ask MAIA destination', () => {
  // Founder walk 2026-11-25: Ask MAIA left Divination for the bare /maia
  // threshold, which does not consume the seed. Divination is now a governed
  // room (in-place sheet); the signed-out fallback goes to the encounter route.
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

  it('opens MAIA in the room when presence can host, else seeds /maia/encounter', () => {
    const src = read('components/oracle/atlas/AskMaia.tsx');
    expect(src).toContain('presence.openMaiaWith(prompt)');
    expect(src).toContain("router.push('/maia/encounter')");
    expect(src).not.toContain("router.push('/maia')");
  });

  it('Reflections MAIA links never land on the bare /maia threshold', () => {
    for (const p of ['components/reflections/DiscussWithMaia.tsx', 'components/reflections/ReflectionsFeed.tsx']) {
      expect(read(p)).not.toContain("router.push('/maia')");
    }
  });

  it('the shared in-room hook hosts first and falls back to /maia/encounter', () => {
    const src = read('components/oracle/useOpenMaiaHere.ts');
    const open = src.indexOf('presence.openMaiaWith(text)');
    const push = src.indexOf("router.push('/maia/encounter')");
    expect(open).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(open);
    expect(src.slice(open, push)).toMatch(/return;/);
  });

  // Founder walk 2026-11-26: Tarot's "Consult with MAIA" left for /maia.
  it('Tarot, Runes and saved readings open MAIA in the room, never /maia?context', () => {
    for (const p of ['app/oracle/tarot/page.tsx', 'app/oracle/runes/page.tsx', 'app/oracle/reflections/page.tsx']) {
      const src = read(p);
      expect(src).toContain('useOpenMaiaHere()');
      expect(src).toMatch(/openMaiaHere\(context, \{ source: 'divination:/);
      expect(src).not.toMatch(/\/maia\?context/);
    }
  });
});
