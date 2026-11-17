/**
 * Control-outcome classifier (pure; no browser here, so it can be tested on its own: classify.test.mjs).
 *
 * Input: what the browser OBSERVED after one control was pressed (see trial.mjs for how it is gathered).
 * Output: { status: PASS | DEAD END | NOT RUN, evidence }.
 *
 * Principles:
 *  - Judge RENDERED content, never only an HTTP status. A 200 with a blank page is a dead end; a "page could not be
 *    found" page that rendered words is still a dead end.
 *  - A control that leads nowhere (no URL, text, aria state, dialog, new control or network change) is a dead end,
 *    even if it is "supposed to" do something. Whether it is a defect or an intended "not yet" state is a product
 *    question; the ledger's job is to make the answer explicit, and the row stays DEAD END until the product says why.
 *  - What the harness cannot decide stays NOT RUN: an external link it will not follow, a click the framework's
 *    dev overlay swallowed, a control that needs a MAIA reply (slice 1 has no MAIA step).
 */
import { PASS, DEAD_END, NOT_RUN } from './ledger.mjs';

/** Fewer visible characters than this on a landing page is "blank" (a spinner word, an empty shell). */
export const REAL_TEXT_MIN = 40;

/** Text that means the page, although it rendered words, is an error page. */
export const ERROR_MARKERS = Object.freeze([
  'This page could not be found',
  'Application error',
  'Internal Server Error',
  'Unhandled Runtime Error',
  'Page not found',
]);

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const clip = (s, n = 90) => { const t = norm(s); return t.length > n ? t.slice(0, n) + '…' : t; };
const pathOf = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return String(u); } };
const pathnameOf = (u) => { try { return new URL(u).pathname; } catch { return String(u); } };
const stripHash = (u) => String(u).split('#')[0];

function firstAdded(before, after) {
  const a = norm(before), b = norm(after);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return clip(b.slice(i), 100) || clip(b, 100);
}

export function classifyTrial(o) {
  const who = `${o.kind || 'control'} "${clip(o.label, 40)}"`;

  // 1. The press itself.
  if (o.clickError) {
    if (o.clickError.kind === 'intercepted-by-page') {
      return { status: DEAD_END, evidence: `${who} cannot be pressed: something else on the page covers it (${clip(o.clickError.message, 120)}); a person could not press it either` };
    }
    return { status: NOT_RUN, evidence: `${who} could not be pressed (${o.clickError.kind}): ${clip(o.clickError.message, 140)}` };
  }

  // 2. Off the product: not followed.
  if (o.externalHref) {
    return { status: NOT_RUN, evidence: `${who} points off the product (${clip(o.externalHref, 80)}); not followed` };
  }

  // 3. Needs MAIA: slice 1 has no MAIA step, and the model is a stub that refuses. Never scored as the page working.
  if (o.modelCalls > 0) {
    return { status: NOT_RUN, evidence: `${who} asked a model (${o.modelCalls} call(s) to the loopback stub, which refuses); slice 1 has no MAIA step. The screen afterwards read: "${clip(o.textAfter, 110)}"` };
  }

  // 3b. Something was still on its way when the window closed: a screen that says "listening…" is not an outcome.
  if (o.pendingRequests > 0) {
    return { status: NOT_RUN, evidence: `${who} left ${o.pendingRequests} request(s) still in flight when the observation window closed, so where it leads is not decided (the screen then read: "${clip(o.textAfter, 80)}")` };
  }

  // 4. A control that could not be pressed because it is disabled.
  if (o.disabled) {
    const why = norm(o.disabledReason);
    return why
      ? { status: PASS, evidence: `${who} is disabled and says why: "${clip(why, 100)}"` }
      : { status: NOT_RUN, evidence: `${who} is disabled on arrival and nothing on it says why (no title or aria description); its precondition is unknown to the harness, so where it leads is not decided` };
  }

  // 5. A same-page anchor.
  if (typeof o.href === 'string' && o.href.startsWith('#')) {
    return o.hashTargetExists
      ? { status: PASS, evidence: `${who} scrolls to #${o.href.slice(1)}, which exists on the page` }
      : { status: DEAD_END, evidence: `${who} points at ${o.href}, and no element with that id is on the page` };
  }

  // 6. Requests the press caused that failed.
  const failed = (o.requests || []).find(r => r.status >= 400);
  if (failed) {
    return { status: DEAD_END, evidence: `${who} sent ${failed.method} ${clip(failed.url, 80)} and it answered HTTP ${failed.status}` };
  }

  // 7. A link whose target answers an error, whatever the client rendered.
  const probe = o.linkProbe?.status;
  if (probe != null && probe >= 400) {
    return { status: DEAD_END, evidence: `${who} -> ${clip(o.href, 80)} answers HTTP ${probe} (dead link)` };
  }

  // 8. The press went somewhere.
  const navigated = stripHash(o.urlAfter) !== stripHash(o.urlBefore) || !!o.popup || (o.document && o.document.status != null);
  if (navigated) {
    const doc = o.document?.status;
    if (doc != null && doc >= 400) {
      return { status: DEAD_END, evidence: `${who} led to ${pathOf(o.urlAfter)} which answered HTTP ${doc}` };
    }
    const landedPath = pathnameOf(o.urlAfter);
    const hrefPath = o.href ? pathnameOf(new URL(o.href, o.origin || 'http://localhost').href) : '';
    if (/^\/(signin|invitation-required)(\/|$)/.test(landedPath) && landedPath !== hrefPath) {
      return { status: DEAD_END, evidence: `${who} bounced to ${pathOf(o.urlAfter)}: the member is sent away from where they were going` };
    }
    if (o.overlay) {
      return { status: DEAD_END, evidence: `${who} led to ${pathOf(o.urlAfter)} where the framework showed an error overlay: "${clip(o.overlay, 100)}"` };
    }
    const text = norm(o.landingText);
    if (text.length < REAL_TEXT_MIN) {
      return { status: DEAD_END, evidence: `${who} led to ${pathOf(o.urlAfter)} (HTTP ${doc ?? 'client-side'}) which rendered ${text.length} characters of text: blank` };
    }
    const marker = ERROR_MARKERS.find(m => text.toLowerCase().includes(m.toLowerCase()));
    if (marker) {
      return { status: DEAD_END, evidence: `${who} led to ${pathOf(o.urlAfter)} which rendered an error page ("${marker}")` };
    }
    return { status: PASS, evidence: `${who} led to ${pathOf(o.urlAfter)} (HTTP ${doc ?? probe ?? 'client-side'}); it reads: "${clip(text, 90)}"` };
  }

  // 9. It stayed on the page: did anything at all change?
  if (o.overlay) {
    return { status: DEAD_END, evidence: `${who} was followed by a framework error overlay: "${clip(o.overlay, 100)}"` };
  }
  const textChanged = norm(o.textBefore) !== norm(o.textAfter);
  const ariaChanged = norm(o.ariaBefore) !== norm(o.ariaAfter);
  const controlsChanged = o.controlsBefore !== o.controlsAfter;
  const okRequest = (o.requests || []).find(r => r.status >= 200 && r.status < 400);
  if (o.dialogOpened || o.fileChooserOpened || textChanged || ariaChanged || controlsChanged || okRequest) {
    const bits = [];
    if (o.dialogOpened) bits.push('a dialog opened');
    if (o.fileChooserOpened) bits.push('the browser’s file chooser opened');
    if (textChanged) bits.push(`the screen now reads "${firstAdded(o.textBefore, o.textAfter)}"`);
    if (ariaChanged) bits.push(`its state changed (${clip(o.ariaBefore, 40)} -> ${clip(o.ariaAfter, 40)})`);
    if (controlsChanged) bits.push(`controls on screen ${o.controlsBefore} -> ${o.controlsAfter}`);
    if (okRequest) bits.push(`${okRequest.method} ${clip(okRequest.url, 60)} answered HTTP ${okRequest.status}`);
    return { status: PASS, evidence: `${who}: ${bits.join('; ')}` };
  }
  if (o.alreadySelected) {
    return { status: PASS, evidence: `${who} is already the current choice (its own state says it is on), so pressing it again leaves the screen as it was` };
  }
  return { status: DEAD_END, evidence: `${who}: nothing happened (no URL, text, aria state, dialog, control or network change within the observation window)` };
}
