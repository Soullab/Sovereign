// FOCUS DESIGN SOUNDS — the session sound saved BESIDE a Focus design (#1979, founder ruling 2026-11-19,
// comment 7021457262). The design stays the LISTEN-48 combination record; this pairing holds only a design id
// and one of the picker's choice names, on this device, and recalling it never plays.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const s = await import(pathToFileURL(path.join(root, 'lib/listening/focusDesignSounds.ts')).href);
const strip = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/[^\n'"`]*$/gm, '');
const memory = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const id = (n) => `design-${String(n).padStart(4, '0')}`;

test('every picker choice can be saved, Open Ground included; nothing else can', () => {
  let x = Object.freeze({});
  for (const [n, sound] of ['none', 'soundscape', 'open-ground', 'deep-focus', 'creative-flow'].entries()) x = s.withDesignSound(x, id(n), sound);
  assert.equal(Object.keys(x).length, 5);
  assert.throws(() => s.withDesignSound(x, id(9), 'https://example.com/track.mp3'), /picker/);
  assert.throws(() => s.withDesignSound(x, id(9), 'open-ground-master'), /picker/);
  assert.throws(() => s.withDesignSound(x, 'x', 'deep-focus'), /picker/);
});

test('saved on this device and read back; an empty list leaves nothing behind', () => {
  const m = memory();
  assert.deepEqual(s.readDesignSounds(m), { sounds: {}, available: true, problem: null });
  const x = s.withDesignSound(s.withDesignSound({}, id(1), 'open-ground'), id(2), 'creative-flow');
  assert.equal(s.writeDesignSounds(m, x), true);
  assert.deepEqual(s.readDesignSounds(m).sounds, x);
  const stored = JSON.parse(m.getItem(s.FOCUS_DESIGN_SOUNDS_STORAGE_KEY));
  assert.deepEqual(Object.keys(stored).sort(), ['format', 'sounds'], 'the pairing holds only its format and the pairs');
  assert.equal(s.writeDesignSounds(m, {}), true);
  assert.equal(m.m.has(s.FOCUS_DESIGN_SOUNDS_STORAGE_KEY), false);
});

test('a removed design takes its sound with it', () => {
  const x = s.withDesignSound(s.withDesignSound({}, id(1), 'deep-focus'), id(2), 'soundscape');
  assert.deepEqual(s.keepDesignSounds(x, [id(2)]), { [id(2)]: 'soundscape' });
  assert.deepEqual(s.keepDesignSounds(x, []), {});
});

test('a damaged, foreign or padded list is reported, never trusted, and not destroyed', () => {
  for (const bad of ['nope', '{"format":"OTHER","sounds":{}}',
    JSON.stringify({ format: s.FOCUS_DESIGN_SOUNDS_FORMAT, sounds: { [id(1)]: 'metal' } }),
    JSON.stringify({ format: s.FOCUS_DESIGN_SOUNDS_FORMAT, sounds: {}, url: 'https://x' })]) {
    const m = memory(); m.setItem(s.FOCUS_DESIGN_SOUNDS_STORAGE_KEY, bad);
    const r = s.readDesignSounds(m);
    assert.deepEqual(r.sounds, {}); assert.match(r.problem, /could not be read/);
    assert.equal(m.getItem(s.FOCUS_DESIGN_SOUNDS_STORAGE_KEY), bad);
  }
});

test('blocked storage: this visit only', () => {
  const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('Quota'); }, removeItem: () => { throw new Error('x'); } };
  assert.equal(s.readDesignSounds(blocked).available, false);
  assert.equal(s.writeDesignSounds(blocked, s.withDesignSound({}, id(1), 'none')), false);
  assert.equal(s.writeDesignSounds(null, {}), false);
});

test('structure: the design record and its encrypted file still hold no sound (LISTEN-48)', () => {
  const designs = strip('lib/listening/focusDesigns.ts');
  for (const banned of ['focusSound', 'FocusSoundId', 'open-ground', 'designSound']) assert.ok(!designs.includes(banned), `focusDesigns.ts mentions ${banned}`);
});

test('structure: the Focus desk passes only design ids; it never chooses, plays or names a sound itself', () => {
  const desk = strip('components/listening/FocusFieldDesk.tsx');
  for (const banned of ['focusSoundChoices', 'setFocusSoundChoice', 'playFocusSound', 'focusSoundChoice', 'FOCUS_DESIGN_SOUNDS', 'focusDesignSounds'])
    assert.ok(!desk.includes(banned), `FocusFieldDesk uses ${banned}`);
  for (const used of ['rememberDesignSound(design.id)', 'recallDesignSound(d.id)', 'keepDesignSoundsFor(']) assert.ok(desk.includes(used), `FocusFieldDesk lacks ${used}`);
});

test('structure: recalling a saved sound selects it and never plays', () => {
  const p = fs.readFileSync(path.join(root, 'components/listening/PersistentListeningProvider.tsx'), 'utf8');
  const body = p.slice(p.indexOf('const recallDesignSound'), p.indexOf('const keepDesignSoundsFor'));
  assert.ok(body.includes('setFocusSoundChoice(saved)'));
  for (const banned of ['play', 'resume', 'Play']) assert.ok(!body.replace(/\/\/[^\n]*/g, '').includes(banned), `recallDesignSound mentions ${banned}`);
});

test('structure: the pairing never reaches the network, MAIA or the media gate', () => {
  const body = strip('lib/listening/focusDesignSounds.ts');
  for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'maia', 'MAIA', 'mediaTicket', 'soundStudioMediaGate', 'indexedDB', 'url'])
    assert.ok(!body.includes(banned), `focusDesignSounds.ts uses ${banned}`);
});
