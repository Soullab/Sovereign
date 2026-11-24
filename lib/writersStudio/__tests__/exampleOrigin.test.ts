/**
 * "Try this on my page" (founder 2026-11-24, "Yes, via the passage"): an example from the Work conversation reaches the page
 * only through the passage path. The browser sends identities; the server loads MAIA's own reply from the member's own
 * conversation on the same manuscript; MAIA proposes afresh, and that proposal is what the latitude check judges.
 */
const query = jest.fn();
jest.mock('@/lib/db/postgres', () => ({ query: (...a: unknown[]) => query(...a) }));

import fs from 'node:fs';
import path from 'node:path';
import { EXAMPLE_REPLY_MAX, exampleOriginInstruction, isExampleOriginRef, TRY_EXAMPLE_WORDS } from '../exampleOrigin';
import { EXAMPLE_TURN_SQL, resolveExampleOrigin } from '../exampleOriginServer';
import { WORK_EXAMPLE_LINE } from '../exampleLevel';

const T = '6f1c2b1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';
const REPLY = `Here is one way.\n\n${WORK_EXAMPLE_LINE}\n\nShe said, don't come back with an answer. Come back with a question.\n\nIt gains a beat.`;
beforeEach(() => query.mockReset());

describe('what the browser may send', () => {
  test('exactly a conversation id and a turn index', () => {
    expect(isExampleOriginRef({ askThreadId: T, turnIndex: 3 })).toBe(true);
    expect(isExampleOriginRef({ askThreadId: T, turnIndex: 3, text: 'my words' })).toBe(false);
    expect(isExampleOriginRef({ askThreadId: 'not-a-uuid', turnIndex: 3 })).toBe(false);
    expect(isExampleOriginRef({ askThreadId: T, turnIndex: -1 })).toBe(false);
    expect(isExampleOriginRef({ askThreadId: T, turnIndex: 1.5 })).toBe(false);
    expect(isExampleOriginRef({ askThreadId: T })).toBe(false);
  });
});

describe('what the server loads', () => {
  test('MAIA\'s own turn, in this member\'s conversation, on the passage\'s manuscript', async () => {
    query.mockResolvedValueOnce({ rows: [{ manuscript_id: 'ms-1' }] }).mockResolvedValueOnce({ rows: [{ body: REPLY }] });
    expect(await resolveExampleOrigin({ memberId: 'm-1', threadId: 'ed-1', ref: { askThreadId: T, turnIndex: 1 } })).toBe(REPLY);
    expect(query.mock.calls[0][1]).toEqual(['ed-1', 'm-1']);
    expect(query.mock.calls[1][0]).toBe(EXAMPLE_TURN_SQL);
    expect(query.mock.calls[1][1]).toEqual([T, 'm-1', 'ms-1', 1]);
    expect(EXAMPLE_TURN_SQL).toMatch(/th\.member_id = \$2 AND th\.manuscript_id = \$3/);
    expect(EXAMPLE_TURN_SQL).toMatch(/t\.speaker = 'maia'/);
  });

  test('nothing when the passage conversation is not theirs, the turn is not found, or it holds no example', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await resolveExampleOrigin({ memberId: 'm-2', threadId: 'ed-1', ref: { askThreadId: T, turnIndex: 1 } })).toBeNull();
    query.mockResolvedValueOnce({ rows: [{ manuscript_id: 'ms-1' }] }).mockResolvedValueOnce({ rows: [] });
    expect(await resolveExampleOrigin({ memberId: 'm-1', threadId: 'ed-1', ref: { askThreadId: T, turnIndex: 9 } })).toBeNull();
    query.mockResolvedValueOnce({ rows: [{ manuscript_id: 'ms-1' }] }).mockResolvedValueOnce({ rows: [{ body: 'No example here.' }] });
    expect(await resolveExampleOrigin({ memberId: 'm-1', threadId: 'ed-1', ref: { askThreadId: T, turnIndex: 1 } })).toBeNull();
    query.mockResolvedValueOnce({ rows: [{ manuscript_id: 'ms-1' }] }).mockResolvedValueOnce({ rows: [{ body: REPLY + 'x'.repeat(EXAMPLE_REPLY_MAX) }] });
    expect(await resolveExampleOrigin({ memberId: 'm-1', threadId: 'ed-1', ref: { askThreadId: T, turnIndex: 1 } })).toBeNull();
  });
});

describe('what MAIA is told', () => {
  test('her own reply, attributed; propose afresh within the writer\'s latitude; the current passage rules; no new facts', () => {
    const i = exampleOriginInstruction(REPLY);
    expect(i).toContain(REPLY);
    expect(i).toMatch(/your own earlier reply, from the Work conversation; not their words/);
    expect(i).toMatch(/as closely as the writer's chosen latitude allows/);
    expect(i).toMatch(/The passage in front of you now is the authority/);
    expect(i).toMatch(/Do not add a fact the writer has not given you/);
    expect(i).toMatch(/If the example does not fit within their latitude, say so plainly/);
  });
});

describe('the route and the turn (source pins)', () => {
  const route = fs.readFileSync(path.join(process.cwd(), 'app/api/writers-studio/editorial/turn/route.ts'), 'utf8');
  const turn = fs.readFileSync(path.join(process.cwd(), 'lib/manuscript/editorialRuntime/turn.ts'), 'utf8');
  test('closed shape, only with "Show me an edit", exclusive with an opening, unresolvable refuses before anything is written', () => {
    expect(route).toMatch(/'origin', 'exampleOrigin',/);
    expect(route).toMatch(/isExampleOriginRef\(b\.exampleOrigin\)/);
    expect(route).toMatch(/b\.exampleOrigin !== undefined && b\.passageAct !== 'revise'/);
    expect(route).toMatch(/'carry', 'origin', 'exampleOrigin'\] as const/);
    const refusal = route.indexOf("error: 'example_not_found', persisted: false }, { status: 404 }");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(route.indexOf('const act = await persistMemberEditorialAct('));
    expect(route).toMatch(/\.\.\.\(exampleOrigin \? \{ exampleOrigin \} : \{\}\),\n\s*\}\);/);
  });
  test('the turn adds the instruction server-side, beside the arrival framing, never as the writer\'s turn', () => {
    expect(turn).toMatch(/input\.exampleOrigin \? exampleOriginInstruction\(input\.exampleOrigin\) : ''/);
  });
  test('the writer\'s turn is only the button\'s words', () => {
    expect(TRY_EXAMPLE_WORDS).toBe('Try that example on my page.');
  });
});
