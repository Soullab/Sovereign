/** @jest-environment node */
/**
 * JARVIS-WRITERS-STUDIO-INSPIRATION-OPENING-01 · S1 falsifiers F7, F8, F10.
 * The opening reflection: pilot-gated, member-scoped, answered by the same MAIA, and never kept (founder Q1).
 */
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { getMemberIdFromRequest } from '@/lib/auth/getMemberFromRequest';
import { writersStudioStanding } from '@/lib/writersStudio/betaAccessServer';
import { askMaia } from '@/lib/manuscript/ask/askReader';
import { POST } from '../route';

jest.mock('@/lib/auth/getMemberFromRequest', () => ({ getMemberIdFromRequest: jest.fn() }));
jest.mock('@/lib/writersStudio/betaAccessServer', () => ({
  writersStudioStanding: jest.fn(),
  // Free admission is closed by default (step B, lib/writersStudio/freeAdmission.ts): admitted = standing.
  admittedToStudio: (access: { admitted: boolean }) => access.admitted,
}));
jest.mock('@/lib/manuscript/ask/askReader', () => ({ askMaia: jest.fn() }));
const latestAge = jest.fn();
jest.mock('@/lib/studios/ageAttestationRead', () => ({
  latestAgeAttestation: (...a: unknown[]) => latestAge(...a),
  ageAttestationAdmits: jest.requireActual('@/lib/studios/ageAttestationRead').ageAttestationAdmits,
}));
const workGate = jest.fn();
jest.mock('@/lib/studios/workAgeGate', () => ({
  ageGateForWork: (...a: unknown[]) => workGate(...a),
  ageGateRefusal: jest.requireActual('@/lib/studios/workAgeGate').ageGateRefusal,
}));

const auth = getMemberIdFromRequest as jest.Mock;
const access = writersStudioStanding as jest.Mock;
const ask = askMaia as jest.Mock;
const ME = '11111111-1111-4111-8111-111111111111';
const WORK = '22222222-2222-4222-8222-222222222222';
const URL_BASE = 'http://localhost/api/sovereign/writers-studio/arrival';
const post = (body: unknown) => new NextRequest(URL_BASE, {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
} as never);

beforeEach(() => {
  jest.clearAllMocks();
  auth.mockResolvedValue(ME);
  access.mockResolvedValue({ admitted: true, plan: 'pro', basis: 'active_beta_tester' });
  latestAge.mockResolvedValue({ band: 'adult', supervised: false });
  workGate.mockResolvedValue({ ok: true });
  ask.mockResolvedValue({
    ok: true, answer: 'I hear a garden. Am I hearing that right?', seen: 'x', seenForQuotes: 'x',
    provenance: { provider: 'anthropic', model: 'm', promptHash: 'h', askerVersion: 'v', answeredAt: 't' },
  });
});

describe('F10 · pilot-gated and member-scoped', () => {
  it('refuses an anonymous request without asking MAIA', async () => {
    auth.mockResolvedValue(null);
    expect((await POST(post({ answer: 'a garden' }))).status).toBe(401);
    expect(ask).not.toHaveBeenCalled();
  });
  it('refuses a member outside the Writer’s Studio pilot without asking MAIA', async () => {
    access.mockResolvedValue({ admitted: false, plan: null, basis: 'not_in_pilot' });
    expect((await POST(post({ answer: 'a garden' }))).status).toBe(403);
    expect(ask).not.toHaveBeenCalled();
  });
  it('⭐ keeps the Spark door open for a writer whose beta grant ended (Free standing, design #2263)', async () => {
    for (const basis of ['grant_lapsed', 'grant_revoked'] as const) {
      access.mockResolvedValue({ admitted: true, plan: 'free', basis, endedAt: '2027-11-13T00:00:00.000Z' });
      expect((await POST(post({ answer: 'a garden' }))).status).toBe(200);
    }
  });
});

describe('F8 · the same MAIA answers', () => {
  it('asks askMaia with the opt-in arrival context, the writer’s words as the question, and returns her reply', async () => {
    const res = await POST(post({ answer: 'a garden', sanctuary: true }));
    expect(res.status).toBe(200);
    expect(ask).toHaveBeenCalledTimes(1);
    const [ctx, history, question] = ask.mock.calls[0];
    expect(ctx).toEqual({ kind: 'arrival', sanctuary: true });
    expect(history).toEqual([]);
    expect(question).toBe('a garden');
    const body = await res.json();
    expect(body.reply).toBe('I hear a garden. Am I hearing that right?');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
  it('carries a short in-page history for "Keep talking", and refuses a malformed one', async () => {
    const history = [{ speaker: 'author', body: 'a garden' }, { speaker: 'maia', body: 'I hear a garden.' }];
    expect((await POST(post({ answer: 'and my grandmother', history }))).status).toBe(200);
    expect(ask.mock.calls[0][1]).toEqual(history);
    expect((await POST(post({ answer: 'x', history: [{ speaker: 'system', body: 'x' }] }))).status).toBe(400);
    expect((await POST(post({ answer: 'x', history: Array.from({ length: 21 }, () => ({ speaker: 'author', body: 'x' })) }))).status).toBe(400);
  });
  it('refuses unknown fields, empty answers and over-long answers', async () => {
    expect((await POST(post({ answer: 'x', workId: 'w' }))).status).toBe(400);
    expect((await POST(post({ answer: '   ' }))).status).toBe(400);
    expect((await POST(post({ answer: 'a'.repeat(2001) }))).status).toBe(413);
    expect(ask).not.toHaveBeenCalled();
  });
  it('reports an unfinished or failed answer as a failure, never as her words', async () => {
    ask.mockResolvedValue({ ok: false, refusal: 'unreachable' });
    const res = await POST(post({ answer: 'a garden' }));
    expect(res.status).toBe(502);
    expect((await res.json()).reply).toBeUndefined();
  });
});

describe('F12/F13 · B: "Show MAIA this page"', () => {
  const PAGE = 'She talked to the tomatoes like they owed her an apology. After the funeral nobody went out there.';
  it('reads only the page, through askMaia with the first-page moment, and returns a reply that quotes it exactly', async () => {
    ask.mockResolvedValue({ ok: true, answer: 'This line stopped me: “She talked to the tomatoes like they owed her an apology.” Is this the start of something?', seen: 'x', seenForQuotes: 'x', provenance: {} });
    const res = await POST(post({ answer: PAGE, moment: 'first_page', work: WORK }));
    expect(res.status).toBe(200);
    expect(ask.mock.calls[0][0]).toEqual({ kind: 'arrival', sanctuary: false, moment: 'first_page' });
    expect(ask.mock.calls[0][1]).toEqual([]);
    expect(ask.mock.calls[0][2]).toBe(PAGE);
  });
  it('never shows a reply that misquotes the writer', async () => {
    ask.mockResolvedValue({ ok: true, answer: 'This stopped me: “She whispered to the tomatoes every morning.”', seen: 'x', seenForQuotes: 'x', provenance: {} });
    const res = await POST(post({ answer: PAGE, moment: 'first_page', work: WORK }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.reply).toBeUndefined();
    expect(body.refusal).toBe('quote_unverified');
  });
  it('takes no history for a page, accepts a page up to the first-page size, and refuses an unknown moment', async () => {
    expect((await POST(post({ answer: PAGE, moment: 'first_page', work: WORK, history: [{ speaker: 'author', body: 'x' }] }))).status).toBe(400);
    expect((await POST(post({ answer: PAGE, moment: 'chapter' }))).status).toBe(400);
    expect((await POST(post({ answer: 'a'.repeat(12001), moment: 'first_page', work: WORK }))).status).toBe(413);
  });
  it('⭐ walk 2026-11-16: a first page names its Work, and only a first page may', async () => {
    expect((await POST(post({ answer: PAGE, moment: 'first_page' }))).status).toBe(400);
    expect((await POST(post({ answer: PAGE, moment: 'first_page', work: 7 }))).status).toBe(400);
    expect((await POST(post({ answer: 'a garden', work: WORK }))).status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });
  it('⭐ walk 2026-11-16 (#1900): MAIA does not read a page of a Work whose recorded program needs the age attestation, until it is given', async () => {
    workGate.mockResolvedValueOnce({ ok: false, refusal: 'age_attestation_required' });
    const res = await POST(post({ answer: PAGE, moment: 'first_page', work: WORK }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'age_attestation_required', refusal: 'age_attestation_required' });
    expect(workGate).toHaveBeenCalledWith(ME, WORK);
    workGate.mockResolvedValueOnce({ ok: false, refusal: 'age_check_unavailable' });
    expect((await POST(post({ answer: PAGE, moment: 'first_page', work: WORK }))).status).toBe(503);
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('F17/F20 · Studio paths: the member’s own path, framed by the registry, never by the client', () => {
  it('a known path reflects through askMaia with the path moment and its id; nothing else is taken from the request', async () => {
    const res = await POST(post({ answer: 'the kitchen at six in the morning', path: 'college-essay' }));
    expect(res.status).toBe(200);
    expect(ask.mock.calls[0][0]).toEqual({ kind: 'arrival', sanctuary: false, moment: 'path', pathId: 'college-essay' });
  });
  it('an unknown or malformed path is refused without asking MAIA, never quietly treated as the generic door', async () => {
    for (const p of ['essay', 'College-Essay', '', 7, null]) {
      expect((await POST(post({ answer: 'x', path: p }))).status).toBe(400);
    }
    expect(ask).not.toHaveBeenCalled();
  });
  it('founder ruling 2026-11-16 (#1900): at the college-essay door MAIA does not speak until the member has attested', async () => {
    for (const a of [null, 'unknown', { band: 'minor', supervised: false }]) {
      latestAge.mockResolvedValueOnce(a);
      const res = await POST(post({ answer: 'x', path: 'college-essay' }));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ refusal: 'age_attestation_required' });
    }
    expect(ask).not.toHaveBeenCalled();
    latestAge.mockResolvedValueOnce({ band: 'minor', supervised: true });
    expect((await POST(post({ answer: 'x', path: 'college-essay' }))).status).toBe(200);
    expect(latestAge).toHaveBeenCalledWith(ME);
  });
  it('the generic door (no program) never asks for an age', async () => {
    latestAge.mockClear();
    expect((await POST(post({ answer: 'the kitchen at six in the morning' }))).status).toBe(200);
    expect(latestAge).not.toHaveBeenCalled();
  });
  it('a path is a door conversation, not a page reading: path with the first-page moment is refused', async () => {
    expect((await POST(post({ answer: 'x', path: 'college-essay', moment: 'first_page' }))).status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('F7 · the opening conversation is never kept (founder Q1)', () => {
  it('the route cannot write: it imports no database, store, thread, or keep module', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'route.ts'), 'utf8');
    const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual([
      '@/lib/auth/getMemberFromRequest',
      '@/lib/manuscript/ask/askReader',
      // Founder ruling 2026-11-16 (#1900): the age-attestation READ (a single SELECT). It can never store: pinned below.
      '@/lib/studios/ageAttestationRead',
      // Walk 2026-11-16 (#1900): the age gate by the Work's RECORDED program (SELECTs only). It can never store: pinned below.
      '@/lib/studios/workAgeGate',
      '@/lib/writersStudio/betaAccessServer',
      '@/lib/writersStudio/inspirationOpening',
      // Studio paths (2026-11-13): a pure, import-free registry; it reads and writes nothing.
      '@/lib/writersStudio/studioPaths',
      'next/server',
    ]);
    expect(src).not.toMatch(/\bquery\s*\(|INSERT|UPDATE|console\.(log|info)\([^)]*answer/);
  });

  it('the one attestation import is read-only: a single SELECT, no write of any kind, no other import but the database', () => {
    const read = fs.readFileSync(path.join(process.cwd(), 'lib/studios/ageAttestationRead.ts'), 'utf8');
    const imports = [...read.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['@/lib/db/postgres']);
    expect(read).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|UPSERT|MERGE)\b/i);
    expect((read.match(/\bquery\s*[<(]/g) ?? []).length).toBe(1);
    expect(read).toContain('SELECT age_band, supervision_attested');
  });

  it('the Work age gate is read-only: SELECTs only, no write of any kind, and only the database, the registry and the attestation read', () => {
    const gate = fs.readFileSync(path.join(process.cwd(), 'lib/studios/workAgeGate.ts'), 'utf8');
    const imports = [...gate.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['./ageAttestationRead', '@/lib/db/postgres', '@/lib/writersStudio/studioPaths']);
    const code = gate.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|UPSERT|MERGE)\b/i);
    for (const sql of code.match(/`[^`]*`/g) ?? []) expect(sql.trim()).toMatch(/^`\s*SELECT\b/);
  });
});
