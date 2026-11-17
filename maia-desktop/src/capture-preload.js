// MAIA Desktop — the Capture window's bridge. SOULLAB-CAPTURE J4a-2.
//
// Owner LISTEN-01 #1979. This preload belongs to ONE window — the small Capture
// window — and exposes Soullab Capture's verbs and nothing else of MAIA. The
// conversation window's bridge (preload.js) carries none of these; the split is
// what keeps capture authority off the conversation surface, and conversation
// authority out of the Capture window. Both lists are reviewed in ONE place:
// test/d01-preload-allowlist.mjs.
//
// ⛔ What deliberately does NOT cross this bridge:
//    · no folder or file location in either direction — main opens the native
//      picker and reveals the take itself
//    · no socket, token, helper process or format choice
//    · no general IPC, no `send`, no Node, no shell
//
// The renderer names an app by the id main returned, and says stop. That is
// the whole of its authority.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('soullabCapture', {
  getState: () => ipcRenderer.invoke('maia:soullab-capture-state'),
  chooseFolder: () => ipcRenderer.invoke('maia:soullab-capture-choose-folder'),
  listApps: () => ipcRenderer.invoke('maia:soullab-capture-sources'),
  start: (sourceId) => ipcRenderer.invoke('maia:soullab-capture-start', { sourceId }),
  stop: () => ipcRenderer.invoke('maia:soullab-capture-stop'),
  revealLastTake: () => ipcRenderer.invoke('maia:soullab-capture-reveal-take'),
  openPrivacySettings: () => ipcRenderer.invoke('maia:soullab-capture-open-privacy'),
  onState: (fn) => {
    if (typeof fn !== 'function') return () => {};
    const handler = (_evt, payload) => fn(payload);
    ipcRenderer.on('maia:soullab-capture-state-changed', handler);
    return () => ipcRenderer.removeListener('maia:soullab-capture-state-changed', handler);
  },
});
