/**
 * Pattern recognition across kept memory — SPIRAL_CONTINUITY_ENGINE §6a (ratified 2026-11-23).
 *
 * Pins the vows the amendment keeps:
 *   - offers are sourced (≥2 refs MAIA was actually given), tentative, and never stored
 *     until the member confirms or corrects them;
 *   - a dismissed reading is not offered again, and only a content-free key is kept;
 *   - the dial (Full default / Gentle / When I ask / Off) is honoured, failing closed;
 *   - Sanctuary is outside it absolutely; practitioner and client material never source it;
 *   - without pattern recognition, the atoms block is byte-identical to before.
 */

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(), transaction: jest.fn() }));

import { readFileSync } from 'fs';
import { join } from 'path';
import { query, transaction } from '@/lib/db/postgres';
import {
  assignPatternRefs,
  buildPatternRecognitionBlock,
  buildPatternTurnContext,
  computeSourceKey,
  confirmPatternOffer,
  dismissPatternOffer,
  extractPatternOffer,
  loadConfirmedPatternsForPrompt,
  loadPatternLevel,
  memberAskedForPatterns,
  offerAllowed,
  parseRawPatternOffer,
  PatternRefusal,
  stripPatternOfferTags,
  validatePatternOffer,
  type ConfirmedPattern,
  type PatternLevel,
} from '../patternRecognition';
import { formatAtomsForPrompt, projectAtomSections, type MemoryAtomSnapshot } from '../memoryAtomsLoader';

const MEMBER = '11111111-1111-4111-8111-111111111111';
const A1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const A2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const A3 = 'aaaaaaaa-0000-4000-8000-000000000003';
const OBS = 'bbbbbbbb-0000-4000-8000-000000000009';
const P1 = 'cccccccc-0000-4000-8000-000000000001';

function atom(id: string, title: string, over: Partial<MemoryAtomSnapshot> = {}): MemoryAtomSnapshot {
  return {
    id,
    title,
    body: null,
    primaryRegister: null,
    registers: [],
    elementalLenses: [],
    status: 'active',
    keptAt: new Date('2026-10-01T00:00:00Z'),
    returnPreference: 'contextual_doorway',
    sourceType: 'spontaneous',
    isBreakthrough: false,
    markedBreakthroughAt: null,
    epistemologicalStatus: null,
    facilitatorId: null,
    ...over,
  } as MemoryAtomSnapshot;
}

const ATOMS = [
  atom(A1, 'the locked room dream', { body: 'a door I could not open' }),
  atom(A2, 'deciding not to rush the move'),
  atom(A3, 'grief at work'),
  atom(OBS, 'practitioner saw a pause', { sourceType: 'practitioner_observation', epistemologicalStatus: 'observed' }),
];

const PATTERN: ConfirmedPattern = {
  id: P1,
  wording: 'Doors and waiting keep showing up together',
  wordedBy: 'member',
  status: 'corrected',
  returnPreference: 'contextual_doorway',
  confirmedAt: new Date('2026-11-01T00:00:00Z'),
  sources: [
    { kind: 'atom', id: A1, label: 'the locked room dream', at: null },
    { kind: 'atom', id: A2, label: 'deciding not to rush the move', at: null },
  ],
};

function ctx(over: Partial<Parameters<typeof buildPatternTurnContext>[0]> = {}) {
  return buildPatternTurnContext({
    sanctuary: false,
    level: 'full',
    atoms: ATOMS,
    patterns: [PATTERN],
    dismissedKeys: new Set(),
    confirmedKeys: new Set(),
    memberMessage: 'I had the door dream again',
    offersThisConversation: 0,
    originSurface: 'maia',
    ...over,
  });
}

beforeEach(() => {
  jest.mocked(query).mockReset();
  jest.mocked(transaction).mockReset();
});

describe('source keys — content-free fingerprints', () => {
  it('are order-independent, de-duplicated sha256 hex', () => {
    const k1 = computeSourceKey([{ kind: 'atom', id: A1 }, { kind: 'atom', id: A2 }]);
    const k2 = computeSourceKey([{ kind: 'atom', id: A2 }, { kind: 'atom', id: A1 }, { kind: 'atom', id: A1.toUpperCase() }]);
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[0-9a-f]{64}$/);
    expect(computeSourceKey([{ kind: 'pattern', id: A1 }, { kind: 'atom', id: A2 }])).not.toBe(k1);
  });
});

describe('the dial (§6a.7)', () => {
  const allowed = (level: PatternLevel, memberMessage = 'hello', offersThisConversation = 0) =>
    offerAllowed({ level, memberMessage, offersThisConversation });

  it('Full allows offers on any turn', () => {
    expect(allowed('full')).toBe(true);
    expect(allowed('full', 'hello', 5)).toBe(true);
  });
  it('Gentle allows one offer per conversation', () => {
    expect(allowed('gentle', 'hello', 0)).toBe(true);
    expect(allowed('gentle', 'hello', 1)).toBe(false);
  });
  it('When I ask allows an offer only when the member asks', () => {
    expect(allowed('on_request', 'how was your day')).toBe(false);
    expect(allowed('on_request', 'do you see a pattern across these?')).toBe(true);
    expect(memberAskedForPatterns('what connects these for you?')).toBe(true);
  });
  it('Off never allows an offer', () => {
    expect(allowed('off', 'show me the patterns')).toBe(false);
  });

  it('no stored setting reads as Full; a failed read fails closed to Off', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [] } as never);
    await expect(loadPatternLevel(MEMBER)).resolves.toBe('full');
    jest.mocked(query).mockRejectedValueOnce(new Error('db down'));
    await expect(loadPatternLevel(MEMBER)).resolves.toBe('off');
    jest.mocked(query).mockResolvedValueOnce({ rows: [{ level: 'surprise' }] } as never);
    await expect(loadPatternLevel(MEMBER)).resolves.toBe('off');
  });
});

describe('turn context — scope and exclusions', () => {
  it('Sanctuary is outside pattern recognition absolutely (§6a.0)', () => {
    expect(ctx({ sanctuary: true })).toBeNull();
  });

  it('Off with nothing confirmed returns null, so the legacy block renders unchanged', () => {
    expect(ctx({ level: 'off', patterns: [] })).toBeNull();
  });

  it('practitioner observations are never given a ref, so they can never be a source (§6a.1)', () => {
    const c = ctx()!;
    expect(c.refs.atomRefs.has(OBS)).toBe(false);
    expect(Array.from(c.refs.byRef.values()).some((s) => s.id === OBS)).toBe(false);
  });

  it('Off with confirmed patterns lists them as the member\'s own but forbids new offers', () => {
    const c = ctx({ level: 'off' })!;
    expect(c.offerAllowed).toBe(false);
    expect(c.atomPatternRecognition.block).toContain('Doors and waiting keep showing up together');
    expect(c.atomPatternRecognition.block).toContain('Do not offer new patterns');
    expect(c.atomPatternRecognition.block).not.toContain('<pattern_offer');
  });
});

describe('prompt discipline', () => {
  it('Full: sources, lenses, prompts-only, tentativeness, no guru stance, the offer line', () => {
    const block = ctx()!.atomPatternRecognition.block;
    expect(block).toContain("member's setting: Full");
    expect(block).toContain('high-level patterns');
    expect(block).toMatch(/cite only the refs/);
    expect(block).toMatch(/never evidence about the person/);
    expect(block).toMatch(/Never cite them and never state them as findings/);
    expect(block).toMatch(/I wonder if/);
    expect(block).toMatch(/Never: stage, trajectory, diagnosis, prediction or identity/);
    expect(block).toMatch(/Never build on a pattern they have not confirmed/);
    expect(block).toMatch(/Quiet is fine/);
    expect(block).toContain('<pattern_offer sources="a1,a3">');
    expect(block).toContain('[p1] "Doors and waiting keep showing up together" — in their own words');
  });

  it('only the patterns handed in are listed — an unconfirmed reading has no way into the prompt', () => {
    const refs = assignPatternRefs(ATOMS, []);
    const block = buildPatternRecognitionBlock({ level: 'full', refs, patterns: [], memberMessage: 'x', offersThisConversation: 0 });
    expect(block).not.toContain('[p1]');
    expect(block).not.toContain('confirmed. These are theirs');
  });

  it('the confirmed-pattern loader reads only confirmed/corrected patterns the member let return', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [] } as never);
    await loadConfirmedPatternsForPrompt(MEMBER);
    const sql = String(jest.mocked(query).mock.calls[0][0]);
    expect(sql).toContain("p.status IN ('confirmed', 'corrected')");
    expect(sql).toContain("p.return_preference = 'contextual_doorway'");
    expect(jest.mocked(query).mock.calls[0][1]).toEqual([MEMBER, 8]);
  });

  it('Gentle offers from kept items only, and stops after one', () => {
    expect(ctx({ level: 'gentle' })!.atomPatternRecognition.block).toContain('drawn only from kept items [aN]');
    expect(ctx({ level: 'gentle', offersThisConversation: 1 })!.atomPatternRecognition.block).toContain('do not offer another');
  });
});

describe('atoms block — legacy bytes preserved; refs only with pattern recognition', () => {
  it('without pattern recognition the member section keeps the no-crossing discipline', () => {
    const out = formatAtomsForPrompt(ATOMS);
    expect(out).toContain('do NOT cross-reference, synthesize, or interpret across them');
    expect(out).toContain('No cross-atom claims.');
    expect(out).not.toMatch(/\[a\d\]/);
    expect(out).not.toContain('PATTERN RECOGNITION');
    expect(formatAtomsForPrompt(ATOMS, undefined)).toBe(out);
  });

  it('with pattern recognition atoms carry refs, the block sits inside the member section', () => {
    const c = ctx()!;
    const sections = projectAtomSections(ATOMS, c.atomPatternRecognition);
    expect(sections.memberSection).toContain('- [a1] "the locked room dream"');
    expect(sections.memberSection).toContain('# PATTERN RECOGNITION');
    expect(sections.memberSection).not.toContain('No cross-atom claims');
    // Practitioner observations stay in their own section, without refs.
    expect(sections.practitionerSection).toContain('"practitioner saw a pause"');
    expect(sections.practitionerSection).not.toMatch(/\[a\d\]/);
  });

  it('confirmed patterns stand even when no atom surfaces this turn', () => {
    const c = ctx({ atoms: [] })!;
    const sections = projectAtomSections([], c.atomPatternRecognition);
    expect(sections.memberSection).toContain('Doors and waiting');
  });
});

describe('extracting MAIA\'s offer', () => {
  const reply = (sources: string) =>
    `What I notice is that the locked door and the decision not to rush seem to travel together. I may be wrong.\n<pattern_offer sources="${sources}">The locked door and not rushing seem to come alive together.</pattern_offer>`;

  it('strips the offer line from what the member sees, every time', () => {
    const x = extractPatternOffer(reply('a1,a2'), ctx());
    expect(x.visibleText).not.toContain('pattern_offer');
    expect(x.visibleText.endsWith('I may be wrong.')).toBe(true);
    expect(stripPatternOfferTags('hi <pattern_offer sources="a1">unclosed')).toBe('hi');
    expect(stripPatternOfferTags('plain text')).toBe('plain text');
  });

  it('accepts a sourced offer and names each source in the member\'s words', () => {
    const x = extractPatternOffer(reply('a1, a2'), ctx());
    expect(x.offer).not.toBeNull();
    expect(x.offer!.sources.map((s) => s.label)).toEqual(['the locked room dream', 'deciding not to rush the move']);
    expect(x.offer!.sourceKey).toBe(computeSourceKey([{ kind: 'atom', id: A1 }, { kind: 'atom', id: A2 }]));
    expect(x.offer!.originSurface).toBe('maia');
  });

  it('accepts a high-level offer built on a confirmed pattern under Full', () => {
    expect(extractPatternOffer(reply('p1,a3'), ctx()).offer?.sources.map((s) => s.kind)).toEqual(['pattern', 'atom']);
  });

  it.each([
    ['a1', undefined, 'too_few_sources'],
    ['a1,a9', undefined, 'unknown_ref'],
    ['p1,a3', { level: 'gentle' as PatternLevel }, 'gentle_pattern_source'],
    ['a1,a2', { level: 'gentle' as PatternLevel, offersThisConversation: 1 }, 'not_allowed'],
    ['a1,a2', { level: 'on_request' as PatternLevel, memberMessage: 'morning' }, 'not_allowed'],
    ['a1,a2', { level: 'off' as PatternLevel }, 'not_allowed'],
  ])('refuses sources=%s with %p → %s', (sources, over, reason) => {
    const x = extractPatternOffer(reply(sources), ctx(over));
    expect(x.offer).toBeNull();
    expect(x.refusedReason).toBe(reason);
    expect(x.visibleText).not.toContain('pattern_offer');
  });

  it('a dismissed reading is not offered again; a kept one is not offered twice', () => {
    const key = computeSourceKey([{ kind: 'atom', id: A1 }, { kind: 'atom', id: A2 }]);
    expect(extractPatternOffer(reply('a1,a2'), ctx({ dismissedKeys: new Set([key]) })).refusedReason).toBe('dismissed');
    expect(extractPatternOffer(reply('a1,a2'), ctx({ confirmedKeys: new Set([key]) })).refusedReason).toBe('already_confirmed');
  });

  it('Sanctuary (no context) refuses any offer', () => {
    expect(validatePatternOffer(parseRawPatternOffer(reply('a1,a2')), null)).toEqual({ offer: null, refusedReason: 'not_allowed' });
  });
});

describe('member acts', () => {
  function fakeTx(responses: Array<{ rows: unknown[] }>) {
    const calls: Array<[string, unknown[]]> = [];
    jest.mocked(transaction).mockImplementation(async (cb: any) =>
      cb({
        query: async (sql: string, params: unknown[]) => {
          calls.push([sql, params]);
          return responses.shift() ?? { rows: [] };
        },
      }),
    );
    return calls;
  }

  it('refuses a pattern on fewer than two sources', async () => {
    await expect(
      confirmPatternOffer({ memberId: MEMBER, wording: 'x', sources: [{ kind: 'atom', id: A1 }], originSurface: 'maia' }),
    ).rejects.toMatchObject({ code: 'too_few_sources' });
  });

  it('re-verifies sources: personal scope, eligible status, not sacred, not practitioner (client material fails)', async () => {
    const calls = fakeTx([{ rows: [{ n: '1' }] }]);
    await expect(
      confirmPatternOffer({
        memberId: MEMBER,
        wording: 'x',
        sources: [{ kind: 'atom', id: A1 }, { kind: 'atom', id: A2 }],
        originSurface: 'maia',
      }),
    ).rejects.toBeInstanceOf(PatternRefusal);
    const sql = calls[0][0];
    expect(sql).toContain("memory_scope = 'personal'");
    expect(sql).toContain("status IN ('active', 'still_alive')");
    expect(sql).toContain("NOT ('sacred_protected' = ANY(registers))");
    expect(sql).toContain("source_type <> 'practitioner_observation'");
    expect(calls[0][1]).toEqual([MEMBER, [A1, A2]]);
    // Nothing was inserted.
    expect(calls.some(([s]) => s.includes('INSERT INTO member_memory_patterns'))).toBe(false);
  });

  it('a correction stores the member\'s words, authored by the member', async () => {
    const calls = fakeTx([{ rows: [{ n: '2' }] }, { rows: [] }, { rows: [{ id: P1 }] }]);
    jest.mocked(query).mockResolvedValueOnce({ rows: [{ ...PATTERN, worded_by: 'member', status: 'corrected', return_preference: 'contextual_doorway', confirmed_at: new Date(), sources: [] }] } as never);
    await confirmPatternOffer({
      memberId: MEMBER,
      wording: "MAIA's wording",
      correctedWording: 'my own words',
      sources: [{ kind: 'atom', id: A1 }, { kind: 'atom', id: A2 }],
      originSurface: 'maia',
    }).catch(() => undefined);
    const insert = calls.find(([s]) => s.includes('INSERT INTO member_memory_patterns'))!;
    expect(insert[1].slice(1, 4)).toEqual(['my own words', 'member', 'corrected']);
    const sourceInserts = calls.filter(([s]) => s.includes('INSERT INTO member_memory_pattern_sources'));
    expect(sourceInserts).toHaveLength(2);
  });

  it('dismissal stores only the member id and a content-free key', async () => {
    jest.mocked(query).mockResolvedValueOnce({ rows: [] } as never);
    const { sourceKey } = await dismissPatternOffer({
      memberId: MEMBER,
      sources: [{ kind: 'atom', id: A1 }, { kind: 'atom', id: A2 }],
    });
    const [sql, params] = jest.mocked(query).mock.calls[0];
    expect(String(sql)).toContain('member_pattern_dismissals');
    expect(params).toEqual([MEMBER, sourceKey]);
  });
});

describe('wiring — the offer line never reaches voice, persistence or the member', () => {
  const root = join(__dirname, '..', '..', '..');
  const service = readFileSync(join(root, 'lib/sovereign/maiaService.ts'), 'utf8');
  const route = readFileSync(join(root, 'app/api/sovereign/app/maia/list/route.ts'), 'utf8');

  it('maiaService captures then strips the line before sanitize, voice and persistence', () => {
    const capture = service.indexOf('parseRawPatternOffer(rawResponse)');
    const strip = service.indexOf('rawResponse = stripPatternOfferTags(rawResponse)');
    const sanitize = service.indexOf('let text = sanitizeMaiaOutput(rawResponse)');
    expect(capture).toBeGreaterThan(0);
    expect(strip).toBeGreaterThan(capture);
    expect(sanitize).toBeGreaterThan(strip);
    expect(service).toContain('stripPatternOfferTags(stripStateVectorBlocks(rawText))');
    expect(service).toMatch(/sanctuary === true \? null : parseRawPatternOffer/);
  });

  it('the central /maia route validates against this turn\'s refs and never in Sanctuary', () => {
    expect(route).toContain('isSanctuary ? null : patternTurnContext');
    expect(route).toContain('sanctuary: isSanctuary');
    expect(route).toContain('projectAtomSections(loadedAtoms, patternTurnContext?.atomPatternRecognition)');
  });
});
