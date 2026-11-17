/**
 * Route authority — the portal contact form, /api/portal/[slug]/inquiry.
 *
 * THE LINE THIS BINDS. The route is public for ONE reason: POST (a visitor
 * writing to a practitioner) must be. GET (list a practitioner's inquiries) and
 * PATCH (set one's status) are NOT public; the handler authorizes them itself
 * (verified session + ownership of the portal), and
 * app/api/portal/[slug]/inquiry/__tests__/route.test.ts proves that. This file
 * binds the DECLARATION to that fact:
 *
 *   - the route is declared (before this rule it was unmapped, so strict mode
 *     would have denied even the public form, and permissive mode gave it no
 *     declared standing at all);
 *   - the declaration says, in its own note, that GET/PATCH authorize
 *     independently, so a public rule is not read as protecting them;
 *   - it is exactly this route and no wildcard, so no neighbouring portal route
 *     inherits a "public" declaration by accident;
 *   - the matrix DEFAULT for unmapped routes is untouched.
 *
 * Every law is also run against hand-made wrong versions of the matrix (source
 * mutations of config/accessMatrix.ts). A suite that only saw the conforming
 * file would not be evidence.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import * as realMatrix from '../accessMatrix';

type Matrix = Pick<typeof realMatrix, 'matchRule' | 'checkAccess' | 'getAccessMode'>;

const FORM = '/api/portal/portal-alpha/inquiry';

/** Run `fn` with ACCESS_CONTROL_MODE set (or unset), restoring whatever was there. */
function withMode<T>(mode: string | undefined, fn: () => T): T {
  const before = process.env.ACCESS_CONTROL_MODE;
  if (mode === undefined) delete process.env.ACCESS_CONTROL_MODE;
  else process.env.ACCESS_CONTROL_MODE = mode;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.ACCESS_CONTROL_MODE;
    else process.env.ACCESS_CONTROL_MODE = before;
  }
}

function expect_(cond: boolean, what: string): asserts cond {
  if (!cond) throw new Error(what);
}

interface Law { id: string; says: string; run: (m: Matrix) => void }

const LAWS: Law[] = [
  {
    id: 'M1-the-form-is-declared',
    says: 'the contact form has an access rule of its own, not the unmapped fallthrough',
    run(m) {
      expect_(m.matchRule(FORM) !== null, 'no rule matches the contact form');
    },
  },
  {
    id: 'M2-an-anonymous-visitor-can-reach-the-form-in-both-modes',
    says: 'public by design: an unauthenticated visitor is admitted, mapped, under permissive AND strict',
    run(m) {
      for (const mode of [undefined, 'strict']) {
        const r = withMode(mode, () => m.checkAccess(FORM, 'free', [], false));
        expect_(r.allowed === true, `denied in mode ${String(mode)}: ${String(r.reason)}`);
        expect_(!r.unmapped, `unmapped in mode ${String(mode)}`);
      }
    },
  },
  {
    id: 'M3-the-declaration-says-GET-and-PATCH-authorize-independently',
    says: 'the rule\'s own note states that GET and PATCH are owner-gated in the handler, so "public" is not read as protection',
    run(m) {
      const note = m.matchRule(FORM)?.notes ?? '';
      expect_(/POST is public/i.test(note) && /\bGET\b/.test(note) && /\bPATCH\b/.test(note) && /independently/i.test(note) && /owner/i.test(note), `note: ${note || '(none)'}`);
    },
  },
  {
    id: 'M4-the-rule-covers-this-route-and-nothing-else',
    says: 'sibling and look-alike portal routes are NOT declared by this rule',
    run(m) {
      const notThis = [
        '/api/portal/portal-alpha/messages',
        '/api/portal/portal-alpha/messages/policy',
        '/api/portal/portal-alpha/pricing',
        '/api/portal/portal-alpha/sliding-scale',
        '/api/portal/portal-alpha/client/status',
        '/api/portal/a/b/inquiry',
        '/api/portal/portal-alpha/inquiry/extra',
        '/api/portal/portal-alpha/inquiry-archive',
        '/api/portal//inquiry',
        '/api/portal/inquiry',
      ];
      const leaked = notThis.filter((p) => m.matchRule(p) !== null);
      expect_(leaked.length === 0, `declared by accident: ${leaked.join(', ')}`);
    },
  },
  {
    id: 'M5-the-unmapped-default-is-untouched',
    says: 'permissive by default, strict only when asked; an undeclared route is allowed-and-flagged vs denied accordingly',
    run(m) {
      const stranger = '/api/never-declared-route-for-this-test';
      expect_(withMode(undefined, () => m.getAccessMode()) === 'permissive', 'default mode is not permissive');
      expect_(withMode('strict', () => m.getAccessMode()) === 'strict', 'strict not honoured');
      expect_(withMode('anything-else', () => m.getAccessMode()) === 'permissive', 'an unknown value is not permissive');
      const open = withMode(undefined, () => m.checkAccess(stranger, 'free', [], false));
      expect_(open.allowed === true && open.unmapped === true, 'permissive default changed');
      const closed = withMode('strict', () => m.checkAccess(stranger, 'free', [], false));
      expect_(closed.allowed === false && closed.unmapped === true, 'strict default changed');
    },
  },
];

describe('portal inquiry route authority — the real matrix', () => {
  for (const law of LAWS) {
    it(`${law.id}: ${law.says}`, () => {
      law.run(realMatrix);
    });
  }
});

/* ── defeat candidates: hand-made wrong versions of config/accessMatrix.ts ── */

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'accessMatrix.ts'), 'utf8');

function mutate(src: string, from: string, to: string): string {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`mutation target must occur exactly once (found ${n}): ${from.slice(0, 70)}`);
  return src.replace(from, () => to);
}

function load(source: string): Matrix {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
  return mod.exports as unknown as Matrix;
}

function failures(m: Matrix): string[] {
  const failed: string[] = [];
  for (const law of LAWS) {
    try {
      law.run(m);
    } catch {
      failed.push(law.id);
    }
  }
  return failed;
}

const RULE_START = '  // Portal contact form. Public ONLY because POST';
const RULE_LINE = /  \{ regex: \/\^\\\/api\\\/portal\\\/\[\^\/\]\+\\\/inquiry\$\/, public: true, notes: '[^\n]*' \},\n/;

function ruleLine(src: string): string {
  const hit = RULE_LINE.exec(src);
  if (!hit) throw new Error('the portal inquiry rule line was not found');
  return hit[0];
}

interface Candidate { name: string; mutate: (s: string) => string; breaks: string[] }

const CANDIDATES: Candidate[] = [
  {
    name: 'DC1 the rule is removed (the route is undeclared, as it was)',
    mutate: (s) => s.replace(ruleLine(s), ''),
    // With no rule there is no note either, so M3 dies with M1/M2: a missing rule has nothing to say.
    breaks: ['M1-the-form-is-declared', 'M2-an-anonymous-visitor-can-reach-the-form-in-both-modes', 'M3-the-declaration-says-GET-and-PATCH-authorize-independently'],
  },
  {
    name: 'DC2 the rule is widened to a /api/portal/ prefix (every portal route declared public)',
    mutate: (s) => s.replace(ruleLine(s), `  { prefix: '/api/portal/', public: true, notes: 'Portal contact form: POST is public by design; GET (list) and PATCH (status) are independently owner-gated in the handler — a public rule here is not protection for them' },\n`),
    breaks: ['M4-the-rule-covers-this-route-and-nothing-else'],
  },
  {
    name: 'DC3 the rule is not public (the contact form would need a login)',
    mutate: (s) => s.replace(ruleLine(s), `  { regex: /^\\/api\\/portal\\/[^/]+\\/inquiry$/, minTier: 'free', notes: 'Portal contact form: POST is public by design; GET (list) and PATCH (status) are independently owner-gated in the handler — a public rule here is not protection for them' },\n`),
    breaks: ['M2-an-anonymous-visitor-can-reach-the-form-in-both-modes'],
  },
  {
    name: 'DC4 the unmapped default is flipped to strict',
    mutate: (s) => mutate(s, "return process.env.ACCESS_CONTROL_MODE === 'strict' ? 'strict' : 'permissive';", "return process.env.ACCESS_CONTROL_MODE === 'permissive' ? 'permissive' : 'strict';"),
    breaks: ['M5-the-unmapped-default-is-untouched'],
  },
  {
    name: 'DC5 the note no longer says GET and PATCH authorize independently',
    mutate: (s) => s.replace(ruleLine(s), `  { regex: /^\\/api\\/portal\\/[^/]+\\/inquiry$/, public: true, notes: 'Portal contact form' },\n`),
    breaks: ['M3-the-declaration-says-GET-and-PATCH-authorize-independently'],
  },
  {
    name: 'DC6 the regex is unanchored (matches look-alike paths)',
    mutate: (s) => s.replace(ruleLine(s), ruleLine(s).replace('/^\\/api\\/portal\\/[^/]+\\/inquiry$/', '/\\/api\\/portal\\/[^/]+\\/inquiry/')),
    breaks: ['M4-the-rule-covers-this-route-and-nothing-else'],
  },
];

describe('portal inquiry route authority — defeat candidates (each wrong matrix must break exactly the laws it names)', () => {
  it('the rule block is present in the real source (the mutations have something to bite)', () => {
    expect(SOURCE).toContain(RULE_START);
    expect(ruleLine(SOURCE)).toContain('public: true');
  });

  it('the loader is faithful: the unmutated source passes every law', () => {
    expect(failures(load(SOURCE))).toEqual([]);
  });

  for (const c of CANDIDATES) {
    it(c.name, () => {
      const wrong = c.mutate(SOURCE);
      expect(wrong).not.toBe(SOURCE); // the mutation actually applied
      expect(failures(load(wrong)).sort()).toEqual([...c.breaks].sort());
    });
  }
});
