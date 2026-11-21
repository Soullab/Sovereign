/**
 * PRACTITIONER-API-IDENTITY-01 — shared two-account boundary check.
 *
 * The boundary is a FUNCTION, not a set of assertions inlined in each suite, so the same
 * check can be run against (a) every real route and (b) deliberately wrong handlers. A
 * check that has only ever seen conforming code is not evidence; the suites that use this
 * run named defeat candidates through it and require each to be caught.
 *
 * Two accounts, A and B. Only A ever holds a session. Every operation is invoked as A (or
 * as nobody) while NAMING B, through whichever channel the route used to read identity.
 *
 *   I1  no session                                  -> 401; nothing read, nothing written
 *   I2  A's session + B's id + B's resource         -> B's data never returned, B's rows never
 *                                                      changed, B never the acting identity;
 *                                                      resource-scoped ops answer 403/404
 *   I3  A's session + B's id + A's resource         -> acts as A (the stray claim is ignored)
 *   I4  A's session + A's id (legacy client)        -> still works
 *   I5  A's token + B in x-member-id                -> 401 (mismatched claim fails closed)
 *
 * The harness knows nothing about routes or stores: the suite supplies a `World` (how to
 * reset it and what a victim would notice) and an `Op` (how to invoke one handler).
 */

export const TOKEN_A = 'session-token-member-a';
export const MEMBER_A = '11111111-1111-4111-8111-111111111111';
export const MEMBER_B = '22222222-2222-4222-8222-222222222222';
export const B_SECRET = 'B-SECRET';

export interface World {
  /** put the world back to its initial state (A and B each own rows; B's carry B_SECRET) */
  seed(): void;
  /** everything B would notice changing, serialised */
  stateOfB(): string;
  /** every identity a store/service was invoked AS */
  identitiesUsed(): Set<string>;
  /** total store/service calls since seed() */
  callCount(): number;
}

export interface Op {
  name: string;
  /** true when the handler addresses one resource (case, growth row...) that B owns */
  resourceScoped: boolean;
  /** status of a legitimate call by the owner */
  okStatus: number;
  invoke(a: {
    /** the identity the CALLER names, in whichever channel the route reads */
    claim: string;
    /** true -> the resource id is A's; false -> B's */
    mine: boolean;
    token?: string;
    headers?: Record<string, string>;
  }): Promise<Response>;
}

export async function exerciseBoundary(label: string, op: Op, w: World): Promise<string[]> {
  const v: string[] = [];

  // I1 — nobody is signed in; the caller names B
  {
    w.seed();
    const before = w.stateOfB();
    const res = await op.invoke({ claim: MEMBER_B, mine: false });
    if (res.status !== 401) v.push(`${label} I1: unauthenticated request answered ${res.status}, not 401`);
    if (w.callCount() !== 0) v.push(`${label} I1: unauthenticated request reached the store (${w.callCount()} calls)`);
    if (w.stateOfB() !== before) v.push(`${label} I1: unauthenticated request changed B's rows`);
  }

  // I2 — A is signed in; names B and B's resource
  {
    w.seed();
    const before = w.stateOfB();
    const res = await op.invoke({ claim: MEMBER_B, mine: false, token: TOKEN_A });
    const text = await res.text();
    if (text.includes(B_SECRET)) v.push(`${label} I2: B's data was returned to A's session`);
    if (w.stateOfB() !== before) v.push(`${label} I2: A's session changed B's rows`);
    if (w.identitiesUsed().has(MEMBER_B)) v.push(`${label} I2: B's member id reached the store as the acting identity`);
    if (op.resourceScoped && ![403, 404].includes(res.status)) {
      v.push(`${label} I2: cross-account resource request answered ${res.status}, not 403/404`);
    }
  }

  // I3 — A is signed in; a stray claim names B but the resource is A's
  {
    w.seed();
    const res = await op.invoke({ claim: MEMBER_B, mine: true, token: TOKEN_A });
    if (res.status !== op.okStatus) v.push(`${label} I3: own resource with a stray claim answered ${res.status}`);
    if (w.identitiesUsed().has(MEMBER_B)) v.push(`${label} I3: the stray claim became the acting identity`);
    if (!w.identitiesUsed().has(MEMBER_A)) v.push(`${label} I3: the session identity never reached the store`);
  }

  // I4 — a legacy client that still sends its own id
  {
    w.seed();
    const res = await op.invoke({ claim: MEMBER_A, mine: true, token: TOKEN_A });
    if (res.status !== op.okStatus) v.push(`${label} I4: legacy client sending its own id answered ${res.status}`);
  }

  // I5 — A's token with B in x-member-id
  {
    w.seed();
    const res = await op.invoke({
      claim: MEMBER_A, mine: true, token: TOKEN_A, headers: { 'x-member-id': MEMBER_B },
    });
    if (res.status !== 401) v.push(`${label} I5: mismatched x-member-id answered ${res.status}, not 401`);
    if (w.identitiesUsed().has(MEMBER_B)) v.push(`${label} I5: x-member-id became the acting identity`);
  }

  return v;
}

/** the auth_sessions row the real session helper reads: TOKEN_A is member A, nothing else is valid */
export function authSessionRows(sql: string, params: unknown[] = []): { rows: unknown[] } | null {
  if (!sql.includes('auth_sessions')) return null;
  return {
    rows: params[0] === TOKEN_A ? [{ member_id: MEMBER_A, tier: 'pro', roles: ['practitioner'] }] : [],
  };
}
