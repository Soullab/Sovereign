// The player bar's Focus links open Focus Field from anywhere (#1979, 2026-11-19). Before, /listen#focus-field and
// /listen#focus-sound always landed on Now, and on the test page Choose a sound left for an empty page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./ts_resolution_loader.mjs', import.meta.url);
const root = path.join(import.meta.dirname, '../..');
const s = await import(pathToFileURL(path.join(root, 'lib/listening/studioSections.ts')).href);

test('both Focus sections open the Focus view; anything else is left alone', () => {
  for (const v of ['#focus-field', 'focus-field', '#focus-sound', 'focus-sound']) assert.equal(s.viewForSection(v), 'focus');
  for (const v of ['', '#', '#sound-studio', '#focus', null, undefined, '#focus-sound-x']) assert.equal(s.viewForSection(v), null);
});

test('structure: the listen room reads the address and the bar event; the bar links use them', () => {
  const room = fs.readFileSync(path.join(root, 'app/listen/ListenRoom.tsx'), 'utf8');
  assert.match(room, /open\(window\.location\.hash\)/);
  assert.match(room, /addEventListener\(STUDIO_SECTION_EVENT/);
  assert.match(room, /addEventListener\('hashchange'/);
  const dock = fs.readFileSync(path.join(root, 'components/listening/PersistentListeningDock.tsx'), 'utf8');
  assert.match(dock, /href="\/listen#focus-field" onClick=\{event => openStudioSection\('focus-field', event\)\}/);
  assert.match(dock, /href="\/listen#focus-sound"[\s\S]{0,120}openStudioSection\('focus-sound', event\)/);
  const picker = fs.readFileSync(path.join(root, 'app/listen/FocusSoundPicker.tsx'), 'utf8');
  assert.match(picker, /<section id="focus-sound"/);
  assert.match(fs.readFileSync(path.join(root, 'components/listening/FocusFieldDesk.tsx'), 'utf8'), /<section id="focus-field"/);
});
