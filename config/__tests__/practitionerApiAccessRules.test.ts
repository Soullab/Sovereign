/**
 * PRACTITIONER-API-IDENTITY-01 — the access matrix names the practitioner API families.
 *
 * /caseload (the PAGE) had a rule; /api/caseload and /api/practice had none, so in the
 * default permissive mode an unmapped path reached its handler WITHOUT a session, and in
 * strict mode was refused as `no-rule-match` rather than for what it was. /api/supervision
 * already carried a rule (free) and is pinned here so it cannot be dropped quietly.
 *
 * ⛔ What these rules are, and are not. `minTier: 'free'` is the AUTHENTICATION boundary only
 * — the same posture `/api/invites/` and `/api/supervision` declare. WHO may act, and on which
 * rows, stays with each handler (session identity + ownership predicate). The matrix is not
 * permitted to become the handlers' excuse, and the handlers are not permitted to rely on it.
 * ⛔ The permissive default and ACCESS_CONTROL_MODE are NOT changed; pinned below.
 *
 * Trailing slash on the new prefixes is deliberate: matchRule uses raw `startsWith`, so a bare
 * '/api/practice' would also capture a sibling such as '/api/practices-admin'.
 */
import { readdirSync, statSync } from 'fs';
import path from 'path';
import { ACCESS_RULES, checkAccess, getAccessMode, matchRule } from '../accessMatrix';

const repoRoot = path.resolve(__dirname, '../..');

/** app/api/<family>/.../route.ts  ->  a concrete request path */
function routePaths(family: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const full = path.join(dir, e);
      if (statSync(full).isDirectory()) {
        if (e !== '__tests__') walk(full);
      } else if (e === 'route.ts') {
        const rel = path.relative(path.join(repoRoot, 'app'), path.dirname(full));
        out.push('/' + rel.split(path.sep).map((s) => (s.startsWith('[') ? 'some-id' : s)).join('/'));
      }
    }
  };
  walk(path.join(repoRoot, 'app/api', family));
  return out;
}

const NEW_FAMILIES: Array<{ family: string; prefix: string }> = [
  { family: 'caseload', prefix: '/api/caseload/' },
  { family: 'practice', prefix: '/api/practice/' },
];

/** every check, as a function over the live ACCESS_RULES so candidates can be run through it */
function evaluate(): string[] {
  const v: string[] = [];

  for (const { family, prefix } of NEW_FAMILIES) {
    const paths = routePaths(family);
    if (paths.length < 9) v.push(`${family}: census found only ${paths.length} routes (vacuous)`);
    for (const p of paths) {
      const rule = matchRule(p);
      if (!rule) v.push(`${p}: no rule`);
      else {
        if (rule.public) v.push(`${p}: is public`);
        if (rule.prefix !== prefix) v.push(`${p}: matched ${rule.prefix ?? rule.exact ?? 'regex'}, not ${prefix}`);
        if (rule.minTier !== 'free') v.push(`${p}: minTier ${rule.minTier}, expected the 'free' authentication boundary`);
        if (rule.rolesAnyOf) v.push(`${p}: carries a role requirement the handlers never had`);
      }
      const anon = checkAccess(p, 'free', [], false);
      if (anon.allowed) v.push(`${p}: an unauthenticated request is allowed`);
      const authed = checkAccess(p, 'free', ['member'], true);
      if (!authed.allowed) v.push(`${p}: an authenticated free member is refused (${authed.reason})`);
    }
  }

  // supervision: already declared; must stay an authenticated, non-public rule
  const sup = matchRule('/api/supervision/sessions');
  if (!sup || sup.public || sup.prefix !== '/api/supervision') v.push('supervision: rule dropped or made public');
  for (const p of routePaths('supervision')) {
    if (matchRule(p)?.public) v.push(`${p}: is public`);
    if (!matchRule(p)) v.push(`${p}: no rule`);
  }

  // siblings are not captured by a bare-prefix accident
  if (matchRule('/api/practices-admin')?.prefix === '/api/practice/') v.push('sibling /api/practices-admin captured by /api/practice/');
  if (matchRule('/api/caseloads')?.prefix === '/api/caseload/') v.push('sibling /api/caseloads captured by /api/caseload/');
  if (matchRule('/api/practitioner/practices/x')?.prefix === '/api/practice/') v.push('/api/practitioner/... captured by /api/practice/');

  return v;
}

describe('PRACTITIONER-API-IDENTITY-01 · access matrix — practitioner API families', () => {
  it('the live matrix satisfies every check', () => {
    expect(evaluate()).toEqual([]);
  });

  it('/api/practitioners/check stays public and /api/practitioners/create stays pro (unchanged)', () => {
    expect(matchRule('/api/practitioners/check')).toMatchObject({ exact: '/api/practitioners/check', public: true });
    expect(matchRule('/api/practitioners/create')).toMatchObject({ exact: '/api/practitioners/create', minTier: 'pro' });
  });

  it('the permissive default is unchanged: an unmapped path is allowed and flagged, and strict mode still refuses it', () => {
    const saved = process.env.ACCESS_CONTROL_MODE;
    try {
      delete process.env.ACCESS_CONTROL_MODE;
      expect(getAccessMode()).toBe('permissive');
      expect(checkAccess('/api/definitely-unmapped-xyz', 'free', ['member'], true)).toMatchObject({ allowed: true, unmapped: true });
      process.env.ACCESS_CONTROL_MODE = 'strict';
      expect(getAccessMode()).toBe('strict');
      expect(checkAccess('/api/definitely-unmapped-xyz', 'free', ['member'], true)).toMatchObject({ allowed: false, reason: 'no-rule-match' });
      // the new families are MAPPED, so strict mode no longer refuses them for being unmapped
      expect(checkAccess('/api/caseload/list', 'free', ['member'], true).allowed).toBe(true);
      expect(checkAccess('/api/practice/growth', 'free', ['member'], true).allowed).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.ACCESS_CONTROL_MODE;
      else process.env.ACCESS_CONTROL_MODE = saved;
    }
  });
});

describe('PRACTITIONER-API-IDENTITY-01 · access matrix — defeat candidates (each must be caught)', () => {
  /** run `evaluate` over a mutated copy of the live rules, always restoring the real ones */
  function withRules(mutate: (rules: typeof ACCESS_RULES) => typeof ACCESS_RULES): string[] {
    const saved = ACCESS_RULES.slice();
    try {
      const next = mutate(saved.slice());
      ACCESS_RULES.splice(0, ACCESS_RULES.length, ...next);
      return evaluate();
    } finally {
      ACCESS_RULES.splice(0, ACCESS_RULES.length, ...saved);
    }
  }
  const without = (prefix: string) => (rules: typeof ACCESS_RULES) => rules.filter((r) => r.prefix !== prefix);

  it('DC-M1 the caseload rule is missing', () => {
    expect(withRules(without('/api/caseload/')).some((m) => m.includes('/api/caseload/') && m.includes('no rule'))).toBe(true);
  });

  it('DC-M2 the practice rule is missing', () => {
    expect(withRules(without('/api/practice/')).some((m) => m.includes('/api/practice/') && m.includes('no rule'))).toBe(true);
  });

  it('DC-M3 the practice rule is public', () => {
    const v = withRules((rules) => rules.map((r) => (r.prefix === '/api/practice/' ? { ...r, public: true } : r)));
    expect(v.some((m) => m.includes('is public'))).toBe(true);
  });

  it('DC-M4 the caseload rule is the bare prefix (captures siblings)', () => {
    const v = withRules((rules) => rules.map((r) => (r.prefix === '/api/caseload/' ? { ...r, prefix: '/api/caseload' } : r)));
    expect(v.some((m) => m.includes('sibling /api/caseloads captured') || m.includes('matched /api/caseload,'))).toBe(true);
  });

  it('DC-M5 the practice rule is narrowed to a role the handlers never required', () => {
    const v = withRules((rules) => rules.map((r) => (r.prefix === '/api/practice/' ? { ...r, rolesAnyOf: ['practitioner' as const] } : r)));
    expect(v.some((m) => m.includes('role requirement'))).toBe(true);
  });

  it('DC-M6 the supervision rule is dropped', () => {
    const v = withRules(without('/api/supervision'));
    expect(v.some((m) => m.includes('supervision'))).toBe(true);
  });

  it('DC-M7 the caseload rule is raised to pro tier', () => {
    const v = withRules((rules) => rules.map((r) => (r.prefix === '/api/caseload/' ? { ...r, minTier: 'pro' as const } : r)));
    expect(v.some((m) => m.includes("expected the 'free'"))).toBe(true);
  });
});
