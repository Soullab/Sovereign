// FOCUS DESIGNS — saved Focus Field designs on this device, and their encrypted file (#1979, 2026-11-19).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const d = await import(pathToFileURL(path.join(root, 'lib/listening/focusDesigns.ts')).href);

const memory = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const design = (n = 1, extra = {}) => d.newFocusDesign({
  name: `Morning code ${n}`, task: 'coding', focusNeed: 'create', musicalWorld: 'cinematic', stimulation: 'medium',
  duration: { mode: 'preset', minutes: 90 }, id: `design-${String(n).padStart(4, '0')}`, at: '2026-11-19T10:00:00Z', ...extra,
});

test('a design is exactly the existing combination record, and holds no task label', () => {
  const x = design();
  assert.deepEqual(Object.keys(x).sort(), ['duration', 'focusNeed', 'format', 'id', 'musicalWorld', 'name', 'savedAt', 'stimulation', 'task']);
  assert.equal(x.format, 'SOULLAB_FOCUS_FIELD_COMBINATION_V1');
  assert.throws(() => d.validateFocusDesign({ ...x, taskLabel: 'Chapter 4' }), /only its own choices/);
  assert.throws(() => d.validateFocusDesign({ ...x, feedback: 'helped' }), /only its own choices/);
});

test('names are required, trimmed and bounded; choices must be real ones', () => {
  assert.equal(design(1, { name: '  Deep   reading  ' }).name, 'Deep reading');
  assert.throws(() => design(1, { name: '   ' }), /name/);
  assert.throws(() => design(1, { name: 'x'.repeat(61) }), /60 characters/);
  assert.throws(() => design(1, { name: 'a\u0007b' }), /cannot be saved/);
  assert.throws(() => design(1, { musicalWorld: 'metal' }), /Musical world/);
  assert.throws(() => design(1, { duration: { mode: 'custom', minutes: 500 } }), /5 to 240/);
  assert.equal(design(1, { duration: { mode: 'untimed', minutes: null } }).duration.mode, 'untimed');
});

test('saved in this browser and read back the same; forgetting leaves nothing behind', () => {
  const s = memory();
  assert.deepEqual(d.readFocusDesigns(s), { designs: [], available: true, problem: null });
  const list = [design(1), design(2)];
  assert.equal(d.writeFocusDesigns(s, list), true);
  assert.deepEqual(d.readFocusDesigns(s).designs, list);
  assert.equal(d.writeFocusDesigns(s, []), true);
  assert.equal(s.m.has(d.FOCUS_DESIGNS_STORAGE_KEY), false);
});

test('at most 24, no duplicates', () => {
  const s = memory();
  assert.equal(d.writeFocusDesigns(s, Array.from({ length: 24 }, (_, i) => design(i + 1))), true);
  assert.equal(d.writeFocusDesigns(s, Array.from({ length: 25 }, (_, i) => design(i + 1))), false);
  assert.equal(d.writeFocusDesigns(s, [design(1), design(1)]), false);
});

test('a damaged or foreign stored list is reported, never trusted, and not destroyed', () => {
  for (const bad of ['not json', '{"format":"OTHER","designs":[]}', JSON.stringify({ format: d.FOCUS_DESIGNS_FORMAT, designs: [{ ...design(), musicalWorld: 'x' }] })]) {
    const s = memory(); s.setItem(d.FOCUS_DESIGNS_STORAGE_KEY, bad);
    const r = d.readFocusDesigns(s);
    assert.deepEqual(r.designs, []); assert.match(r.problem, /could not be read/);
    assert.equal(s.getItem(d.FOCUS_DESIGNS_STORAGE_KEY), bad, 'the stored list was changed by reading it');
  }
});

test('blocked storage falls back to this visit only', () => {
  const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => { throw new Error('x'); } };
  assert.deepEqual(d.readFocusDesigns(blocked), { designs: [], available: false, problem: null });
  assert.equal(d.writeFocusDesigns(blocked, [design()]), false);
  assert.equal(d.readFocusDesigns(null).available, false);
});

test('the encrypted file round-trips, refuses a wrong passphrase and a short one, and holds no plain text', async () => {
  const list = [design(1), design(2, { name: 'Evening reading', task: 'reading' })];
  const file = await d.encryptFocusDesigns(list, 'correct horse battery');
  assert.ok(!file.includes('Evening reading') && !file.includes('coding'), 'the file exposes a design');
  assert.equal(JSON.parse(file).format, 'SOULLAB_FOCUS_DESIGNS_PRIVATE_V1');
  assert.deepEqual(await d.decryptFocusDesigns(file, 'correct horse battery'), list);
  await assert.rejects(d.decryptFocusDesigns(file, 'wrong horse battery!'), /Unable to unlock/);
  await assert.rejects(d.encryptFocusDesigns(list, 'short'), /12 or more/);
  await assert.rejects(d.decryptFocusDesigns('{"format":"SOULLAB_LISTEN_RECEPTIVE_PRIVATE_V1"}', 'correct horse battery'), /not a Soullab focus designs file/);
});

test('structure: designs never reach the network, MAIA, or the media gate', () => {
  const body = fs.readFileSync(path.join(root, 'lib/listening/focusDesigns.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'maia', 'MAIA', 'mediaTicket', 'soundStudioMediaGate', 'indexedDB'])
    assert.ok(!body.includes(banned), `focusDesigns.ts uses ${banned}`);
});
