/**
 * Tests for the pure part of the browser glue: what counts as "the page changed" when waiting for it to be still.
 * (The rest of trial.mjs needs a browser: see fixture-check.mjs.)
 * Run: node --test tests/e2e/journey-ledger/lib/*.test.mjs
 *
 * Why the address is part of the key: a press that starts a Work and then navigates (Just let me write -> POST, POST, GET,
 * router.push) shows its next controls BEFORE the address changes. A wait that only watched text and control count thought
 * the page was still while the navigation was on its way, and the next press was credited with it (row P1-05.09.01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Trial from './trial.mjs';

const sig = (o = {}) => ({ url: 'http://localhost:3000/writers-studio', text: 'Where would you like to begin? Home Write Develop', controls: 12, aria: 'Home:page', ...o });

test('settleKey: the same screen has the same key', () => {
  assert.equal(typeof Trial.settleKey, 'function', 'trial.mjs exports settleKey, the one function that decides what "changed" means while waiting');
  assert.equal(Trial.settleKey(sig()), Trial.settleKey(sig()));
});

test('settleKey: a change of ADDRESS alone is a change (the late navigation of the earlier press)', () => {
  assert.notEqual(Trial.settleKey(sig()), Trial.settleKey(sig({ url: 'http://localhost:3000/writers-studio?mode=write&m=39cefb93' })));
});

test('settleKey: a change of text, of control count, or of aria state is a change', () => {
  const k = Trial.settleKey(sig());
  assert.notEqual(k, Trial.settleKey(sig({ text: 'Something else' })));
  assert.notEqual(k, Trial.settleKey(sig({ controls: 13 })));
  assert.notEqual(k, Trial.settleKey(sig({ aria: 'Home:false' })));
});

// A defeat candidate: the key the harness had before (text, control count and aria only). It must NOT satisfy the test above.
const oldKey = (s) => `${s.text.length}|${s.text.slice(0, 200)}|${s.controls}|${s.aria}`;
test('defeat candidate is caught: a key that ignores the address cannot tell the page before the navigation from the page after it', () => {
  const before = sig(); const after = sig({ url: 'http://localhost:3000/writers-studio?mode=write&m=39cefb93' });
  assert.equal(oldKey(before), oldKey(after), 'precondition: the old key really is blind to the address');
  assert.notEqual(Trial.settleKey(before), Trial.settleKey(after), 'the conforming key is not');
});

test('PRESS_QUIET_MS and PRESS_STILL_CAP_MS are named, not buried', () => {
  assert.ok(Trial.PRESS_QUIET_MS >= 500, 'long enough for a client-side router.push that follows a response');
  assert.ok(Trial.PRESS_STILL_CAP_MS >= Trial.PRESS_QUIET_MS * 4);
});
