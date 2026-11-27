/**
 * Pattern recognition in the What Now? room family (SCE §6a, ratified 2026-11-23).
 *
 * Both interview routes compose their turn prompt through lib/maia/roomComposition.
 * When presence is on and the client renders the offer card, MAIA receives refs and
 * the Pattern Offer discipline; the route captures the offer line from the raw reply,
 * strips it before the reply is returned (the client speaks the reply and carries it
 * back as history), and validates it against this turn's refs. 'propose' never
 * receives refs. A client that cannot render the card keeps the strict block.
 */
import { NextRequest } from 'next/server';
import { getLLMProvider } from '@/lib/consciousness/LLMProvider';
import { loadMemberMemoryAtomsForPrompt, type MemoryAtomSnapshot } from '@/lib/maia/memoryAtomsLoader';
import { query } from '@/lib/db/postgres';
import { POST as nowWhatPOST } from '@/app/api/now-what/interview/route';
import { POST as visionStudioPOST } from '@/app/api/maia/vision-studio/interview/route';

jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/auth/serverSessions', () => ({ getCurrentSession: jest.fn(async () => ({ memberId: 'member-room' })) }));
jest.mock('@/lib/scribe/scribeAuth', () => ({ getMemberIdFromRequest: jest.fn(async () => 'member-room') }));
jest.mock('@/lib/consciousness/LLMProvider', () => ({
  getLLMProvider: jest.fn(),
  ensureUserTerminal: (m: unknown[]) => m,
}));
jest.mock('@/lib/consciousness/spiralogic-core', () => ({ inferSpiralogicCell: jest.fn(async () => null) }));
jest.mock('@/lib/maia/memoryLoaders', () => ({
  loadRecentDevelopmentalMemories: jest.fn(async () => []),
  loadRecentThemeSignals: jest.fn(async () => []),
  loadPriorCrossSessionExchanges: jest.fn(async () => []),
  loadConversationalRecallPref: jest.fn(async () => false),
}));
jest.mock('@/lib/maia/memoryAtomsLoader', () => ({
  ...jest.requireActual('@/lib/maia/memoryAtomsLoader'),
  loadMemberMemoryAtomsForPrompt: jest.fn(),
}));
jest.mock('@/lib/practiceField/practiceFieldService', () => ({
  getPracticeFieldById: jest.fn(async () => null),
  getPracticeFieldBySlug: jest.fn(async () => null),
  formatFieldContextForRoom: jest.fn(() => ''),
}));
jest.mock('@/lib/practiceField/compositionBoundary', () => ({ memberMayComposeField: jest.fn(async () => ({ authorized: false })) }));
jest.mock('@/lib/practiceField/programPositionService', () => ({ composeProgramPositionBlock: jest.fn(async () => ({ block: '' })) }));
jest.mock('@/lib/practiceField/programAuthoringService', () => ({ composeLessonContext: jest.fn(async () => '') }));

const A1 = '0a000000-0000-4000-8000-000000000001';
const A2 = '0a000000-0000-4000-8000-000000000002';
function atom(id: string, title: string): MemoryAtomSnapshot {
  return {
    id, title, body: null, primaryRegister: null, registers: [], elementalLenses: [], status: 'active',
    keptAt: new Date('2026-10-01T00:00:00Z'), returnPreference: 'contextual_doorway', sourceType: 'spontaneous',
    isBreakthrough: false, markedBreakthroughAt: null, epistemologicalStatus: null, facilitatorId: null,
  };
}
const OFFER_LINE = '<pattern_offer sources="a1,a2">Leaving keeps showing up as the door you want.</pattern_offer>';
const VISIBLE = 'What I hear is a pull toward the door.';
const generateSimple = jest.fn();
const ORIGINAL_PRESENCE = process.env.NOW_WHAT_MAIA_PRESENCE_ENABLED;

function post(handler: typeof nowWhatPOST, url: string, body: Record<string, unknown>) {
  return handler(new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
}

const ROUTES = [
  { name: 'now-what', handler: nowWhatPOST, url: 'http://localhost/api/now-what/interview' },
  { name: 'vision-studio', handler: visionStudioPOST, url: 'http://localhost/api/maia/vision-studio/interview' },
];

beforeEach(() => {
  process.env.NOW_WHAT_MAIA_PRESENCE_ENABLED = '1';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  generateSimple.mockReset().mockResolvedValue({ text: `${VISIBLE}\n${OFFER_LINE}`, provider: 'test', model: 'test' });
  jest.mocked(getLLMProvider).mockReturnValue({ generateSimple } as never);
  jest.mocked(loadMemberMemoryAtomsForPrompt).mockReset().mockResolvedValue([atom(A1, 'I want to leave the job'), atom(A2, 'The open road')]);
  jest.mocked(query).mockReset().mockResolvedValue({ rows: [] } as never); // no dial row → Full
});
afterEach(() => {
  jest.restoreAllMocks();
  if (ORIGINAL_PRESENCE === undefined) delete process.env.NOW_WHAT_MAIA_PRESENCE_ENABLED;
  else process.env.NOW_WHAT_MAIA_PRESENCE_ENABLED = ORIGINAL_PRESENCE;
});

const turn = (over: Record<string, unknown> = {}) => ({
  mode: 'turn', history: [{ role: 'user', content: 'I keep thinking about leaving.' }], patternOffersThisConversation: 0, ...over,
});

describe.each(ROUTES)('$name interview: pattern offer', ({ handler, url }) => {
  it('turn with presence: refs reach MAIA; the reply returned is stripped; the offer is validated', async () => {
    const res = await post(handler, url, turn());
    expect(res.status).toBe(200);
    const body = await res.json();
    const prompt = generateSimple.mock.calls[0][0].systemPrompt as string;
    expect(prompt).toContain('# PATTERN RECOGNITION');
    expect(prompt).toContain('[a1]');
    expect(body.reply).toBe(VISIBLE);
    expect(JSON.stringify(body)).not.toMatch(/<\/?pattern_offer/i);
    expect(body.patternOffer).toMatchObject({ originSurface: 'room', wording: 'Leaving keeps showing up as the door you want.' });
    expect(body.patternOffer.sources.map((s: { id: string }) => s.id)).toEqual([A1, A2]);
  });

  it('a client that does not render the card keeps the strict block; a stray tag is stripped', async () => {
    const res = await post(handler, url, turn({ patternOffersThisConversation: undefined }));
    const body = await res.json();
    const prompt = generateSimple.mock.calls[0][0].systemPrompt as string;
    expect(prompt).toContain('No cross-atom claims');
    expect(prompt).not.toContain('PATTERN RECOGNITION');
    expect(body.reply).toBe(VISIBLE);
    expect(body.patternOffer).toBeUndefined();
  });

  it('presence off: no atoms, no refs, no offer — the tag still never reaches the member', async () => {
    process.env.NOW_WHAT_MAIA_PRESENCE_ENABLED = '0';
    const res = await post(handler, url, turn());
    const body = await res.json();
    expect(generateSimple.mock.calls[0][0].systemPrompt).not.toContain('PATTERN RECOGNITION');
    expect(body.reply).toBe(VISIBLE);
    expect(body.patternOffer).toBeUndefined();
  });

  it('Gentle: once an offer was made in this conversation, another is refused', async () => {
    jest.mocked(query).mockImplementation((async (sql: string) =>
      /member_pattern_preferences/.test(sql) ? { rows: [{ level: 'gentle' }] } : { rows: [] }) as never);
    const res = await post(handler, url, turn({ patternOffersThisConversation: 1 }));
    const body = await res.json();
    expect(body.reply).toBe(VISIBLE);
    expect(body.patternOffer).toBeUndefined();
  });

  it("'propose' never receives refs and never returns an offer", async () => {
    generateSimple.mockResolvedValue({ text: `[]\n${OFFER_LINE}`, provider: 'test', model: 'test' });
    const res = await post(handler, url, turn({ mode: 'propose' }));
    const body = await res.json();
    expect(generateSimple.mock.calls[0][0].systemPrompt).not.toContain('PATTERN RECOGNITION');
    expect(body.patternOffer).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/pattern_offer/i);
  });
});
