/**
 * Pattern recognition on Between (SCE §6a, ratified 2026-11-23).
 *
 * Between generates through lib/consciousness/maiaOrchestrator → getMaiaResponse, so
 * its raw reply is captured at the same maiaService choke point as /maia: the offer
 * line is parsed, then stripped before sanitize, voice synthesis and persistence (that
 * point is pinned in lib/maia/__tests__/patternRecognition.test.ts). This file proves
 * the rest of the Between path:
 *   - the orchestrator carries the raw offer up to the route, never inside `message`;
 *   - the route issues refs only outside Sanctuary and only to a client that renders
 *     the offer card, validates against THIS turn's refs, and persists/returns the
 *     stripped text;
 *   - Sanctuary never reads the dial and never carries an offer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(async () => ({ rows: [] })), transaction: jest.fn() }));
jest.mock('@/lib/sovereign/maiaService', () => ({ getMaiaResponse: jest.fn() }));

import { query } from '@/lib/db/postgres';
import { getMaiaResponse } from '@/lib/sovereign/maiaService';
import { generateMaiaTurn } from '@/lib/consciousness/maiaOrchestrator';
import { formatAtomsForPrompt, type MemoryAtomSnapshot } from '@/lib/maia/memoryAtomsLoader';
import {
  clientRendersPatternOffers,
  offersThisConversationFrom,
  parseRawPatternOffer,
  preparePatternTurn,
  stripPatternOfferTags,
  validatePatternOffer,
} from '@/lib/maia/patternRecognition';

const ROOT = process.cwd();
const between = readFileSync(join(ROOT, 'app/api/between/chat/route.ts'), 'utf8');

const A1 = '0a000000-0000-4000-8000-000000000001';
const A2 = '0a000000-0000-4000-8000-000000000002';
function atom(id: string, title: string): MemoryAtomSnapshot {
  return {
    id, title, body: null, primaryRegister: null, registers: [], elementalLenses: [], status: 'active',
    keptAt: new Date('2026-10-01T00:00:00Z'), returnPreference: 'contextual_doorway', sourceType: 'spontaneous',
    isBreakthrough: false, markedBreakthroughAt: null, epistemologicalStatus: null, facilitatorId: null,
  };
}
const OFFER_LINE = '<pattern_offer sources="a1,a2">Both kept moments turn on leaving.</pattern_offer>';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(query).mockReset().mockResolvedValue({ rows: [] } as never);
});
afterEach(() => jest.restoreAllMocks());

describe('Between: the orchestrator carries the raw offer, never inside the message', () => {
  it('passes patternOfferRaw from getMaiaResponse up to the route', async () => {
    jest.mocked(getMaiaResponse).mockResolvedValue({
      text: 'Visible.', patternOfferRaw: { sources: 'a1,a2', wording: 'Both kept moments turn on leaving.' }, provider: 'test',
    } as never);
    const r = await generateMaiaTurn({ message: 'hello', userId: 'member-1', sessionId: 's-1', meta: { sanctuary: false } as never });
    expect(r.message).toBe('Visible.');
    expect(r.patternOfferRaw).toEqual({ sources: 'a1,a2', wording: 'Both kept moments turn on leaving.' });
  }, 30_000);

  it('adds nothing when MAIA made no offer', async () => {
    jest.mocked(getMaiaResponse).mockResolvedValue({ text: 'Visible.', provider: 'test' } as never);
    const r = await generateMaiaTurn({ message: 'hello', userId: 'member-1', sessionId: 's-2', meta: {} as never });
    expect('patternOfferRaw' in r).toBe(false);
  }, 30_000);
});

describe('Between: one turn, end to end through the shared functions', () => {
  const atoms = [atom(A1, 'I left the city'), atom(A2, 'I want to leave again')];

  it('a card-rendering client gets refs; the member sees stripped text; the offer validates against this turn', async () => {
    const ctx = await preparePatternTurn({
      memberId: 'member-1', sanctuary: false, atoms, memberMessage: 'hi',
      offersThisConversation: offersThisConversationFrom(0), originSurface: 'between',
    });
    expect(ctx).not.toBeNull();
    const block = formatAtomsForPrompt(atoms, ctx?.atomPatternRecognition);
    expect(block).toContain('[a1]');
    expect(block).toContain('# PATTERN RECOGNITION');

    // The maiaService choke point: capture, then strip.
    const raw = `I hear the leaving.\n${OFFER_LINE}`;
    const captured = parseRawPatternOffer(raw);
    const visible = stripPatternOfferTags(raw);
    expect(visible).toBe('I hear the leaving.');

    const { offer } = validatePatternOffer(captured, ctx);
    expect(offer?.originSurface).toBe('between');
    expect(offer?.sources.map((s) => s.id)).toEqual([A1, A2]);
  });

  it('Sanctuary: no dial read, no refs, and any offer is refused', async () => {
    const ctx = await preparePatternTurn({
      memberId: 'member-1', sanctuary: true, atoms, memberMessage: 'hi', offersThisConversation: 0, originSurface: 'between',
    });
    expect(ctx).toBeNull();
    expect(query).not.toHaveBeenCalled();
    expect(formatAtomsForPrompt(atoms, ctx?.atomPatternRecognition)).toContain('No cross-atom claims');
    expect(validatePatternOffer(parseRawPatternOffer(OFFER_LINE), null).offer).toBeNull();
  });

  it('a failed read keeps the strict block (never throws into the turn)', async () => {
    jest.mocked(query).mockRejectedValue(new Error('db down') as never);
    const ctx = await preparePatternTurn({
      memberId: 'member-1', sanctuary: false, atoms, memberMessage: 'hi', offersThisConversation: 0, originSurface: 'between',
    });
    // Dial read fails closed to Off; with nothing confirmed there is no context.
    expect(ctx).toBeNull();
  });

  it('only a client that sends the Gentle count is treated as rendering the card', () => {
    expect(clientRendersPatternOffers(0)).toBe(true);
    expect(clientRendersPatternOffers(2)).toBe(true);
    for (const v of [undefined, null, '0', NaN, Infinity, {}]) expect(clientRendersPatternOffers(v)).toBe(false);
    expect(offersThisConversationFrom(-3)).toBe(0);
    expect(offersThisConversationFrom(2.7)).toBe(2);
    expect(offersThisConversationFrom('x')).toBe(0);
  });
});

describe('Between route wiring (structure)', () => {
  const memoryBlockStart = between.indexOf("if (!isSanctuary && effectiveUserId && !effectiveUserId.startsWith('anon:')) {");
  const prepareAt = between.indexOf('preparePatternTurn({');

  it('issues refs only inside the non-Sanctuary, recognised-member memory block, and only to a card-rendering client', () => {
    expect(memoryBlockStart).toBeGreaterThan(0);
    expect(prepareAt).toBeGreaterThan(memoryBlockStart);
    expect(between).toMatch(/clientRendersPatternOffers\(patternOffersSoFar\)\s*\?\s*await preparePatternTurn\(\{/);
    expect(between).toMatch(/sanctuary: isSanctuary,[\s\S]{0,200}originSurface: 'between'/);
    expect(between).toContain('formatAtomsForPrompt(memberMemoryAtoms, patternTurnContext?.atomPatternRecognition)');
  });

  it('validates the raw offer against this turn and never in Sanctuary', () => {
    expect(between).toMatch(/validatePatternOffer\(\s*orchestratorResult\.patternOfferRaw,\s*isSanctuary \? null : patternTurnContext,\s*\)/);
  });

  it('persists and returns the stripped message; the raw offer is never persisted or returned', () => {
    expect(between).toContain('let finalMessage = orchestratorResult.message;');
    expect(between).toMatch(/addConversationExchange\(safeSessionId, message, cleanedText,/);
    expect(between).toMatch(/message: cleanedText,\s*\/\/ 🧩[^\n]*\n\s*\.\.\.\(patternOffer \? \{ patternOffer \} : \{\}\)/);
    // Only the validated offer leaves the route.
    const rawUses = between.match(/patternOfferRaw/g) ?? [];
    expect(rawUses).toHaveLength(1);
  });
});
