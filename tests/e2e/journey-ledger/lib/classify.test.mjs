/**
 * Tests for the control-outcome classifier: given what a browser OBSERVED after a control was pressed, does it
 * lead somewhere (PASS), lead nowhere (DEAD END), or can it not be decided (NOT RUN)?
 * Run: node --test tests/e2e/journey-ledger/lib/*.test.mjs
 *
 * The classifier must judge RENDERED content, never only an HTTP status: a 200 with a blank page is a dead end,
 * and a Next "This page could not be found" page that rendered text is still a dead end.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PASS, DEAD_END, NOT_RUN } from './ledger.mjs';
import { classifyTrial as conforming, REAL_TEXT_MIN, ERROR_MARKERS } from './classify.mjs';
import * as Classify from './classify.mjs';

const REAL = 'Where would you like to begin? Your words first. Structure stays yours. Bring a manuscript you already have.';
const base = (o = {}) => ({
  label: 'A control', kind: 'button', href: null, disabled: false,
  clickError: null,
  urlBefore: 'http://localhost:3000/writers-studio', urlAfter: 'http://localhost:3000/writers-studio',
  origin: 'http://localhost:3000',
  document: null, linkProbe: null, popup: null,
  landingText: '', textBefore: 'Home page text that was here before', textAfter: 'Home page text that was here before',
  ariaBefore: '', ariaAfter: '', controlsBefore: 4, controlsAfter: 4,
  requests: [], modelCalls: 0, dialogOpened: false, overlay: null,
  ...o,
});

const CASES = [
  ['a link to a page that renders real text is PASS',
    base({ kind: 'link', href: '/writers-studio/plans', urlAfter: 'http://localhost:3000/writers-studio/plans', document: { status: 200 }, linkProbe: { status: 200 }, landingText: REAL }), PASS],
  ['a link whose page answers 404 is a DEAD END even though the 404 page has text',
    base({ kind: 'link', href: '/writers-studio/plans', urlAfter: 'http://localhost:3000/writers-studio/plans', document: { status: 404 }, linkProbe: { status: 404 }, landingText: '404 This page could not be found. Go home.' }), DEAD_END],
  ['a link probed as 404 is a DEAD END even when client navigation rendered something',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/x', linkProbe: { status: 404 }, landingText: REAL }), DEAD_END],
  ['a 500 is a DEAD END',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/x', document: { status: 500 }, landingText: REAL }), DEAD_END],
  ['HTTP 200 with a blank page is a DEAD END (status alone is never enough)',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/x', document: { status: 200 }, linkProbe: { status: 200 }, landingText: '   ' }), DEAD_END],
  ['HTTP 200 with a few words only is a DEAD END',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/x', document: { status: 200 }, landingText: 'Loading' }), DEAD_END],
  ['HTTP 200 whose rendered text is the framework not-found page is a DEAD END',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/x', document: { status: 200 }, landingText: '404 | This page could not be found. ' + REAL }), DEAD_END],
  ['an application error page is a DEAD END',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/x', document: { status: 200 }, landingText: 'Application error: a client-side exception has occurred while loading localhost. ' + REAL }), DEAD_END],
  ['a framework error overlay is a DEAD END',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/x', document: { status: 200 }, landingText: REAL, overlay: 'Unhandled Runtime Error TypeError: x is undefined' }), DEAD_END],
  ['being bounced to sign-in is a DEAD END',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/signin?next=%2Fx', document: { status: 200 }, landingText: REAL }), DEAD_END],
  ['being bounced to the invitation-required page is a DEAD END',
    base({ kind: 'link', href: '/x', urlAfter: 'http://localhost:3000/invitation-required', document: { status: 200 }, landingText: REAL }), DEAD_END],
  ['a button that does nothing at all (no URL, text, aria, network, dialog) is a DEAD END',
    base({ label: 'Write' }), DEAD_END],
  ['a button that changes the visible text is PASS',
    base({ textAfter: 'Home page text that was here before. Preferences: Layout, Theme' }), PASS],
  ['a button that only flips an aria state (a toggle) is PASS',
    base({ ariaBefore: 'Ordinary:true|Sanctuary:false', ariaAfter: 'Ordinary:false|Sanctuary:true' }), PASS],
  ['a button that opens a dialog is PASS',
    base({ dialogOpened: true }), PASS],
  ['a button that reveals new controls is PASS',
    base({ controlsAfter: 9 }), PASS],
  ['a button that sends a request that succeeds is PASS',
    base({ clickMs: 30, requests: [{ method: 'POST', url: '/api/sovereign/living-works', status: 201, startOffsetMs: 40 }] }), PASS],
  ['a button whose request fails (4xx) is a DEAD END even if the screen also changed',
    base({ clickMs: 30, textAfter: 'Something went wrong', requests: [{ method: 'POST', url: '/api/sovereign/living-works', status: 403, startOffsetMs: 40 }] }), DEAD_END],
  ['a button whose request fails (5xx) is a DEAD END',
    base({ clickMs: 30, requests: [{ method: 'POST', url: '/api/x', status: 500, startOffsetMs: 40 }] }), DEAD_END],
  ['a control that needs a model call is NOT RUN, never PASS (slice 1 has no MAIA step)',
    base({ modelCalls: 1, textAfter: 'I couldn’t answer just now. Nothing was kept.', requests: [{ method: 'POST', url: '/api/sovereign/maia', status: 200, startOffsetMs: 40 }] }), NOT_RUN],
  ['a click the browser could not perform because something else was on top is a DEAD END (a person could not press it either)',
    base({ clickError: { kind: 'intercepted-by-page', message: 'div.modal intercepts pointer events' } }), DEAD_END],
  ['a click intercepted by the framework dev overlay cannot be decided: NOT RUN',
    base({ clickError: { kind: 'intercepted-by-dev-overlay', message: 'nextjs-portal intercepts pointer events' } }), NOT_RUN],
  ['a control that could not be found again is NOT RUN',
    base({ clickError: { kind: 'not-found', message: 'no such control' } }), NOT_RUN],
  ['a click that timed out for the harness is NOT RUN',
    base({ clickError: { kind: 'timeout', message: 'timeout' } }), NOT_RUN],
  ['an external link is NOT RUN (not followed off the product)',
    base({ kind: 'link', href: 'https://example.org/x', externalHref: 'https://example.org/x' }), NOT_RUN],
  ['a mailto link is NOT RUN (a handler outside the browser page)',
    base({ kind: 'link', href: 'mailto:hello@example.org', externalHref: 'mailto:hello@example.org' }), NOT_RUN],
  ['a disabled control with no stated reason is NOT RUN: the harness cannot tell whether it leads anywhere, and "disabled until you choose" is not a defect',
    base({ disabled: true, disabledReason: '' }), NOT_RUN],
  ['a control that opens the browser’s own file chooser is PASS (a native dialog changes no DOM)',
    base({ label: 'Choose file', fileChooserOpened: true }), PASS],
  ['a request still in flight when the window closed cannot be decided: NOT RUN, even though the screen changed ("MAIA is listening…")',
    base({ textAfter: 'MAIA is listening…', pendingRequests: 1 }), NOT_RUN],
  ['a disabled control that states why is PASS',
    base({ disabled: true, disabledReason: 'Write something first' }), PASS],
  ['pressing the choice that is already selected (aria-pressed true) and nothing changing is PASS: re-pressing the current choice is a no-op by definition',
    base({ label: 'Ordinary', alreadySelected: true }), PASS],
  ['an unselected toggle that does nothing is still a DEAD END',
    base({ label: 'Sanctuary', alreadySelected: false }), DEAD_END],
  ['a same-page anchor to an id that is not on the page is a DEAD END',
    base({ kind: 'link', href: '#missing', hashTargetExists: false }), DEAD_END],
  ['a same-page anchor to an id that exists is PASS',
    base({ kind: 'link', href: '#present', hashTargetExists: true, urlAfter: 'http://localhost:3000/writers-studio#present' }), PASS],

  // ---- F2: a request is credited to the press only if the press STARTED it ----
  ['an inert button is a DEAD END even though the page answered a request of its own that STARTED BEFORE the press (the import room’s own fetch landing late on a cold route)',
    base({ label: 'Write', clickMs: 30, requests: [{ method: 'GET', url: '/api/sovereign/manuscripts/unfinished-uploads', status: 200, startOffsetMs: -1800 }] }), DEAD_END],
  ['an inert button is a DEAD END when an unrelated request began long after the press (a page beacon at +900 ms)',
    base({ label: 'Develop', clickMs: 30, requests: [{ method: 'GET', url: '/api/members/me', status: 200, startOffsetMs: 900 }] }), DEAD_END],
  ['a request whose start time is unknown cannot be credited to the press: an inert button stays a DEAD END',
    base({ label: 'Write', clickMs: 30, requests: [{ method: 'GET', url: '/api/x', status: 200 }] }), DEAD_END],
  ['a request that began while a slow click was still being delivered is the press’s: PASS',
    base({ label: 'Save', clickMs: 400, requests: [{ method: 'POST', url: '/api/save', status: 200, startOffsetMs: 600 }] }), PASS],
  ['a request that began later than the click plus the attribution window is not the press’s: DEAD END',
    base({ label: 'Save', clickMs: 400, requests: [{ method: 'POST', url: '/api/save', status: 200, startOffsetMs: 1200 }] }), DEAD_END],
  ['a page request that FAILED but started before the press is not blamed on a press that did something',
    base({ clickMs: 30, textAfter: 'Home page text that was here before. Preferences: Layout, Theme', requests: [{ method: 'GET', url: '/api/poll', status: 500, startOffsetMs: -200 }] }), PASS],

  // ---- F1: a change that lands after a press made on a page that was still moving is not the press's ----
  ['Home pressed while the Work-creation requests were still in flight: the address that changes afterwards is the earlier press’s landing, so NOT RUN, never PASS',
    base({ label: 'Home', unsettledAtPress: '1 request(s) still in flight', urlBefore: 'http://localhost:3000/writers-studio', urlAfter: 'http://localhost:3000/writers-studio?mode=write&m=39cefb93-0000', landingText: REAL }), NOT_RUN],
  ['a press made while the page was still changing that then changes the text cannot be attributed: NOT RUN',
    base({ unsettledAtPress: 'the page had not been still', textAfter: 'Home page text that was here before. Something else arrived' }), NOT_RUN],
  ['a press made on a moving page that then shows nothing is NOT RUN too (the page may simply have been busy), never a DEAD END the harness cannot stand behind',
    base({ unsettledAtPress: '1 request(s) still in flight' }), NOT_RUN],
  ['a dead link is still a dead link whatever the page was doing when it was pressed',
    base({ kind: 'link', href: '/x', unsettledAtPress: '1 request(s) still in flight', urlAfter: 'http://localhost:3000/x', linkProbe: { status: 404 }, landingText: REAL }), DEAD_END],
  ['a request the press caused that failed is still a DEAD END on a page that was moving',
    base({ clickMs: 30, unsettledAtPress: '1 request(s) still in flight', requests: [{ method: 'POST', url: '/api/x', status: 500, startOffsetMs: 40 }] }), DEAD_END],
];


for (const [name, obs, want] of CASES) {
  test(`conforming: ${name}`, () => {
    const out = conforming(obs);
    assert.equal(out.status, want, `evidence was: ${out.evidence}`);
    assert.ok(typeof out.evidence === 'string' && out.evidence.trim().length > 0, 'every outcome carries evidence');
  });
}

test('PASS evidence quotes what was rendered, so a reader can see it was not just a status', () => {
  const out = conforming(CASES[0][1]);
  assert.match(out.evidence, /Where would you like to begin/);
  assert.match(out.evidence, /200/);
});

test('the framework markers and the minimum text length are named, not buried', () => {
  assert.ok(REAL_TEXT_MIN >= 20);
  assert.ok(ERROR_MARKERS.some(m => /could not be found/i.test(m)));
});

test('attribution: only a request that STARTED after the press began, within the attribution window of its end, is the press’s', () => {
  const caused = Classify.isCausedByPress;
  assert.equal(typeof caused, 'function', 'classify.mjs exports isCausedByPress (the one rule trial.mjs and the classifier share)');
  assert.ok(Classify.ATTRIBUTION_MS > 0 && Classify.ATTRIBUTION_MS < 600, 'a few hundred ms: a page beacon at +600 ms is not the press’s');
  assert.equal(caused({ startOffsetMs: 0 }, 0), true);
  assert.equal(caused({ startOffsetMs: Classify.ATTRIBUTION_MS }, 0), true);
  assert.equal(caused({ startOffsetMs: Classify.ATTRIBUTION_MS + 1 }, 0), false, 'beyond the window');
  assert.equal(caused({ startOffsetMs: 250 }, 400), true, 'a slow click is allowed for');
  assert.equal(caused({ startOffsetMs: -1 }, 400), false, 'started before the press');
  assert.equal(caused({ startOffsetMs: null }, 400), false, 'start unknown (the harness was not yet watching): never credited');
  assert.equal(caused({}, 400), false, 'no start time recorded: never credited');
  assert.equal(caused({ startOffsetMs: 'soon' }, 400), false);
});

test('a request that was discounted is named in the evidence of the DEAD END, so a reader can see what was set aside', () => {
  const out = conforming(base({ label: 'Write', clickMs: 30, requests: [{ method: 'GET', url: '/api/sovereign/manuscripts/unfinished-uploads', status: 200, startOffsetMs: -1800 }] }));
  assert.equal(out.status, DEAD_END);
  assert.match(out.evidence, /not started by the press/);
  assert.match(out.evidence, /unfinished-uploads/);
});

test('a press made on a page that was still moving says so, and says what it could not attribute', () => {
  const out = conforming(base({ label: 'Home', unsettledAtPress: '1 request(s) still in flight', urlAfter: 'http://localhost:3000/writers-studio?mode=write&m=abc', landingText: REAL }));
  assert.equal(out.status, NOT_RUN);
  assert.match(out.evidence, /still moving/);
  assert.match(out.evidence, /1 request\(s\) still in flight/);
});

// ---- defeat candidates: plausible WRONG classifiers. Every one must disagree with the table on at least one case. ----
const statusOnly = (o) => {
  const st = o.document?.status ?? o.linkProbe?.status;
  if (st != null) return { status: st >= 400 ? DEAD_END : PASS, evidence: 'status ' + st };
  return { status: PASS, evidence: 'no status' };
};
const noChangeIsFine = (o) => {
  const r = conforming(o);
  return r.status === DEAD_END && /nothing|no URL/i.test(r.evidence) ? { status: PASS, evidence: 'treated as fine' } : r;
};
const modelCountsAsPass = (o) => conforming({ ...o, modelCalls: 0 });
const interceptIsNotRun = (o) => (o.clickError?.kind === 'intercepted-by-page' ? { status: NOT_RUN, evidence: 'x' } : conforming(o));
const textOnly = (o) => {
  if (o.kind === 'link' && !o.externalHref && o.href && !String(o.href).startsWith('#')) {
    return { status: (o.landingText || '').trim().length >= REAL_TEXT_MIN ? PASS : DEAD_END, evidence: 'text only' };
  }
  return conforming(o);
};
const selectedIsAlwaysFine = (o) => (o.kind === 'button' && !o.href && !o.clickError && !o.externalHref && !o.disabled ? { status: PASS, evidence: 'any button passes' } : conforming(o));
const disabledIsDeadEnd = (o) => (o.disabled && !String(o.disabledReason || '').trim() && !o.clickError && !o.externalHref && !(o.modelCalls > 0) ? { status: DEAD_END, evidence: 'disabled' } : conforming(o));
const ignoresPending = (o) => conforming({ ...o, pendingRequests: 0 });
const ignoresFileChooser = (o) => conforming({ ...o, fileChooserOpened: false });
const ignoresUnsettled = (o) => conforming({ ...o, unsettledAtPress: null });
// F2 wrong rules: credit every request in the window; credit one that started before the press; credit one whose start is unknown; no window.
const creditsEveryRequest = (o) => conforming({ ...o, requests: (o.requests || []).map(r => ({ ...r, startOffsetMs: 0 })) });
const creditsRequestsFromBeforeThePress = (o) => conforming({ ...o, requests: (o.requests || []).map(r => (typeof r.startOffsetMs === 'number' && r.startOffsetMs < 0 ? { ...r, startOffsetMs: 0 } : r)) });
const creditsRequestsOfUnknownStart = (o) => conforming({ ...o, requests: (o.requests || []).map(r => (typeof r.startOffsetMs !== 'number' ? { ...r, startOffsetMs: 0 } : r)) });
const noAttributionWindow = (o) => conforming({ ...o, requests: (o.requests || []).map(r => (typeof r.startOffsetMs === 'number' && r.startOffsetMs > 0 ? { ...r, startOffsetMs: 0 } : r)) });
const unsettledOnlyCoversNavigation = (o) => (o.unsettledAtPress && !(o.urlAfter !== o.urlBefore) ? conforming({ ...o, unsettledAtPress: null }) : conforming(o));
const CANDIDATES = {
  'DC-J a press on a page that was still moving is credited with whatever changed afterwards (the Home press credited with the earlier Just-let-me-write landing)': ignoresUnsettled,
  'DC-K every same-origin request in the window is credited to the press (an inert button passes on the page’s own fetch)': creditsEveryRequest,
  'DC-L a request that started BEFORE the press is credited to it (a late answer to the page’s own request)': creditsRequestsFromBeforeThePress,
  'DC-M a request whose start time is unknown is credited to the press': creditsRequestsOfUnknownStart,
  'DC-N a request that began long after the press (a page beacon) is credited to it': noAttributionWindow,
  'DC-O a moving page only voids a press that changed the address (a text change on a moving page is still credited)': unsettledOnlyCoversNavigation,
  'DC-G a disabled control is called a DEAD END (asserts a defect nobody saw)': disabledIsDeadEnd,
  'DC-H a request still in flight is ignored (an in-progress screen scored as the page working)': ignoresPending,
  'DC-I a native file chooser is not seen (a working button scored as inert)': ignoresFileChooser,
  'DC-F every inert button is excused as "already selected"': selectedIsAlwaysFine,
  'DC-A status-only: 200 means it works': statusOnly,
  'DC-B inert counts as fine': noChangeIsFine,
  'DC-C a model call is scored as the page working': modelCountsAsPass,
  'DC-D a click the page itself blocked is scored NOT RUN (hides a real dead end)': interceptIsNotRun,
  'DC-E text-only: a 404 page that has words passes': textOnly,
};
for (const [name, wrong] of Object.entries(CANDIDATES)) {
  test(`defeat candidate is caught: ${name}`, () => {
    const disagreements = CASES.filter(([, obs, want]) => wrong(obs).status !== want);
    assert.ok(disagreements.length > 0, 'no case in the table distinguishes this wrong classifier from the right one');
  });
}
