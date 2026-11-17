/**
 * PRACTITIONER-SESSION-OWNERSHIP-01 — static guard · the CLIENTS of the now-authenticated
 * practice / supervision routes present the session the way the project documents.
 *
 * Why this exists: every route under `/api/practice/` and `/api/supervision/` now needs the session
 * (most of them needed nothing before). A plain `fetch(apiUrl(...))` carries no `x-session-token`, so on a
 * native / Safari cross-origin WebView (the Capacitor cookie trap in CLAUDE.md, `lib/http/apiBase.ts`) it
 * would start answering 401 where it used to work. `apiFetch()` is the documented way to present the
 * session. The callers that matter here were changed to it; this guard keeps a bare `fetch` from coming
 * back, and names the callers that were deliberately NOT changed.
 *
 * ⛔ NOT claimed: this is a source-structural guard over `fetch(` call sites. It does not run a browser or
 * a WebView, and says nothing about EventSource (which cannot set headers and carries the cookie only —
 * the transport is unchanged and the consequence is reported in the inventory record).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');

/** a bare `fetch(` whose first argument is (apiUrl of) one of the two route prefixes */
const BARE_FETCH_TO_GUARDED_ROUTE =
  /(?<![A-Za-z0-9_$.])fetch\(\s*(?:apiUrl\(\s*)?[`'"]\/api\/(?:practice|supervision)\//g;

export function bareFetchesToGuardedRoutes(src: string): string[] {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  return [...code.matchAll(BARE_FETCH_TO_GUARDED_ROUTE)].map((m) => {
    const rest = code.slice(m.index! + m[0].length, m.index! + m[0].length + 60).split(/[`'"]/)[0]!;
    return `/api/${m[0].split('/api/')[1]}${rest}`;
  });
}

/**
 * Callers that are NOT changed, each with the reason. A RATCHET: an entry whose file no longer contains a
 * bare fetch to these prefixes is stale and fails, so the list can only shrink.
 */
const UNCHANGED_CALLERS: Record<string, string> = {
  'app/labtools/scribe/page.tsx':
    'transcript/stream and upload were ALREADY authenticated routes before this change (bare fetch, pre-existing ' +
    'Capacitor-trap exposure, unchanged); only session/start and session/stop here go through apiFetch',
  'components/masters/FieldSessionListener.tsx':
    'same-origin RELATIVE url (carries the maia_session cookie on web; the surface has no native build) — the ' +
    'session list it calls is now the signed-in practitioner\'s own, so its `practitionerId=` param is ignored',
};

const SCAN_ROOTS = ['app', 'components', 'lib', 'hooks'];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // route handlers are servers, not clients
      if (path.relative(repoRoot, full) === path.join('app', 'api')) continue;
      sourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(path.relative(repoRoot, full));
    }
  }
  return acc;
}

const files = SCAN_ROOTS.flatMap((r) => {
  try { return sourceFiles(path.join(repoRoot, r)); } catch { return []; }
});
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8');

/** the callers this change converted from a bare fetch to apiFetch */
const CONVERTED_CALLERS = [
  'components/supervision/SupervisionRecorder.tsx',
  'components/supervision/EssenceViewer.tsx',
  'components/supervision/InsightsViewer.tsx',
  'components/supervision/PracticePanel.tsx',
  'components/supervision/TranscriptViewer.tsx',
  'app/supervision/page.tsx',
];

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · callers present the session (apiFetch, not a bare fetch)', () => {
  it('finds the client population (the guard is not vacuously passing)', () => {
    expect(files.length).toBeGreaterThan(500);
    for (const rel of CONVERTED_CALLERS) expect(files).toContain(rel);
    for (const rel of Object.keys(UNCHANGED_CALLERS)) expect(files).toContain(rel);
  });

  it('no client calls a /api/practice or /api/supervision route with a bare fetch, outside the named, reasoned exceptions', () => {
    const offenders = files
      .filter((rel) => !(rel in UNCHANGED_CALLERS))
      .map((rel) => ({ rel, hits: bareFetchesToGuardedRoutes(read(rel)) }))
      .filter((x) => x.hits.length > 0)
      .map((x) => `${x.rel} — ${x.hits.join(', ')}`);
    expect(offenders).toEqual([]);
  });

  it('the exception list is a RATCHET: each entry still has a bare fetch, and a reason', () => {
    for (const [rel, reason] of Object.entries(UNCHANGED_CALLERS)) {
      expect(bareFetchesToGuardedRoutes(read(rel)).length).toBeGreaterThan(0);
      expect(reason.length).toBeGreaterThan(30);
    }
  });

  it('every converted caller actually uses apiFetch for these routes', () => {
    for (const rel of CONVERTED_CALLERS) {
      expect(read(rel)).toMatch(/\bapiFetch\(/);
      expect(read(rel)).toMatch(/import \{[^}]*\bapiFetch\b[^}]*\} from '@\/lib\/http\/apiBase'/);
    }
  });
});

describe('PRACTITIONER-SESSION-OWNERSHIP-01 · callers guard — defeat candidates (each must be caught)', () => {
  it('control: the real, converted callers are clean', () => {
    for (const rel of CONVERTED_CALLERS) expect(bareFetchesToGuardedRoutes(read(rel))).toEqual([]);
  });

  it('DC-F1 a converted caller reverted to `fetch(apiUrl(...))` (the shipped shape) is caught', () => {
    const src = read('components/supervision/SupervisionRecorder.tsx').replace(
      "apiFetch('/api/supervision/session/start', {",
      "fetch(apiUrl('/api/supervision/session/start'), {",
    );
    expect(bareFetchesToGuardedRoutes(src)).toEqual(['/api/supervision/session/start']);
  });

  it('DC-F2 the multi-line form `fetch(\\n apiUrl(`...`),` is caught', () => {
    const src = "const res = await fetch(\n  apiUrl(`/api/supervision/transcript/list?sessionId=${id}`),\n  { cache: 'no-store' }\n);";
    expect(bareFetchesToGuardedRoutes(src)).toHaveLength(1);
  });

  it('DC-F3 a bare fetch with a relative template literal is caught', () => {
    expect(bareFetchesToGuardedRoutes("fetch(`/api/practice/insights/generate?sessionId=${id}`)")).toHaveLength(1);
  });

  it('DC-F4 apiFetch, a comment, a method named fetch and other routes are NOT flagged (no false positives)', () => {
    expect(bareFetchesToGuardedRoutes("await apiFetch('/api/supervision/sessions?limit=20')")).toEqual([]);
    expect(bareFetchesToGuardedRoutes("// was: fetch(apiUrl('/api/supervision/sessions'))\n/* fetch('/api/practice/x') */")).toEqual([]);
    expect(bareFetchesToGuardedRoutes("client.fetch('/api/supervision/sessions')")).toEqual([]);
    expect(bareFetchesToGuardedRoutes("await fetch(apiUrl('/api/journal/quick/list'))")).toEqual([]);
  });

  it('DC-F5 an exception entry whose file no longer has a bare fetch would be STALE (the ratchet condition)', () => {
    expect(bareFetchesToGuardedRoutes(read('components/supervision/PracticePanel.tsx')).length).toBe(0);
    // i.e. if someone listed PracticePanel as an exception, `toBeGreaterThan(0)` in the ratchet would fail
  });
});
