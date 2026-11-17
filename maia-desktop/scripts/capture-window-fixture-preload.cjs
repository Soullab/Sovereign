// SOULLAB-CAPTURE J4a-2 — FIXTURE ONLY. Stands in for src/capture-preload.js
// so scripts/capture-window-screens.cjs can render the real capture.html in
// fixed states for the Experience Contract screenshots. Never packaged: the
// build copies only package.json, src and build.
const { contextBridge } = require('electron');

const arg = process.argv.find((a) => a.startsWith('--capture-fixture='));
const name = arg ? arg.split('=')[1] : 'idle';
const APPS = [
  { id: 'pid:20840', name: 'QuickTime Player', producingOutput: true },
  { id: 'pid:300', name: 'Music', producingOutput: false },
  { id: 'pid:412', name: 'Safari', producingOutput: false },
];
const recording = { phase: 'recording', source: { name: 'QuickTime Player' }, seconds: 83.2, peak: [0.42, 0.37], discontinuities: 0, folderName: 'Soullab Recordings', folderExternal: false };
const STATES = {
  'first-run': { phase: 'idle', folderName: null },
  choose: { phase: 'idle', folderName: 'witness-takes', folderExternal: true },
  recording,
  // The renderer decides "waiting" from the clock standing still; this fixture
  // freezes the clock by sending the same seconds forever.
  waiting: { ...recording, seconds: 4.0, peak: [0, 0] },
  'ended-device': { phase: 'idle', folderName: 'Soullab Recordings',
    lastTake: { fileName: 'Soullab Capture 2026-11-17 17.50.09.wav', seconds: 257.8, sampleRate: 48000, empty: false, gaps: 0, appName: 'QuickTime Player', stopReason: 'deviceChanged' } },
  permission: { phase: 'idle', folderName: 'Soullab Recordings', error: 'PERMISSION_DENIED' },
};

contextBridge.exposeInMainWorld('soullabCapture', {
  getState: async () => STATES[name],
  chooseFolder: async () => ({ ok: false }),
  listApps: async () => ({ ok: true, sources: APPS }),
  start: async () => ({ ok: false }),
  stop: async () => ({ ok: true }),
  revealLastTake: async () => ({ ok: true }),
  openPrivacySettings: async () => ({ ok: true }),
  onState: () => () => {},
});
