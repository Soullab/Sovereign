// MAIA Desktop — the Capture window's surface. SOULLAB-CAPTURE J4a-2.
//
// It speaks only `window.soullabCapture` (src/capture-preload.js) and renders
// what CaptureView decides. It holds no recording, no location and no timer of
// the helper's: the one local timer below only notices that the recording
// clock has STOPPED moving, which is how "Waiting for audio" is shown without
// polling the helper.

(function main() {
  'use strict';

  const cap = window.soullabCapture;
  const View = window.CaptureView;
  const $ = (id) => document.getElementById(id);

  let state = { phase: 'idle' };
  let lastSeconds = -1;
  let lastAdvanceAt = Date.now();
  let lastSoundAt = Date.now();

  function render() {
    const v = View.describe(state, { now: Date.now(), lastAdvanceAt, lastSoundAt });
    document.body.className = `${v.recording ? 'recording ' : ''}mode-${v.mode}`;
    $('headline').textContent = v.headline;
    $('detail').textContent = v.detail;

    $('error').hidden = !v.error;
    $('error').textContent = v.error;
    $('permission').hidden = !v.permissionHelp;

    $('live').hidden = !(state.phase === 'recording' || state.phase === 'starting');
    $('stop').hidden = !(state.phase === 'recording' || state.phase === 'starting');
    $('time').textContent = v.time || '0:00';
    $('m0').style.width = `${Math.round(v.meter[0] * 100)}%`;
    $('m1').style.width = `${Math.round(v.meter[1] * 100)}%`;
    $('gaps').textContent = v.gaps ? `${v.gaps} gap${v.gaps === 1 ? '' : 's'} marked` : '';

    $('choose').hidden = !v.canChoose;
    $('folder').disabled = !v.canChoose;
    $('folderName').textContent = v.folder || 'No folder chosen';
    $('folderName').className = v.folder ? '' : 'muted';
    $('folder').textContent = v.folder ? 'Change…' : 'Choose…';
    $('folderNote').hidden = !v.folderNote;
    $('folderNote').textContent = v.folderNote;

    $('last').hidden = !v.lastTake;
    if (v.lastTake) {
      $('lastName').textContent = v.lastTake.name;
      $('lastFacts').textContent = v.lastTake.empty
        ? 'Empty'
        : v.lastTake.silent ? [v.lastTake.length, 'silent'].join(' · ')
        : [v.lastTake.length, v.lastTake.rate, v.lastTake.gaps ? `${v.lastTake.gaps} gaps` : 'no gaps'].filter(Boolean).join(' · ');
      $('lastSentence').textContent = v.lastTake.sentence;
    }
    $('recovery').hidden = !v.recovery;
    $('recovery').textContent = v.recovery;
  }

  function accept(next) {
    if (!next || next.ok === false) return;
    if (next.phase === 'recording') {
      if (next.seconds !== lastSeconds) { lastSeconds = next.seconds; lastAdvanceAt = Date.now(); }
      if (Array.isArray(next.peak) && next.peak.some((p) => p > 0)) lastSoundAt = Date.now();
    } else {
      lastSeconds = -1;
      lastAdvanceAt = Date.now();
      lastSoundAt = Date.now();
    }
    const prevPhase = state.phase;
    state = next;
    render();
    if (View.shouldReloadApps(prevPhase, state.phase)) void loadApps();
  }

  async function loadApps() {
    const list = $('apps');
    if (state.phase !== 'idle') return;
    if (!state.folderName) {
      list.innerHTML = '';
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Choose a folder first.';
      list.append(li);
      return;
    }
    list.innerHTML = '<li class="muted">Looking for apps…</li>';
    const res = await cap.listApps();
    list.innerHTML = '';
    if (!res || !res.ok) {
      const li = document.createElement('li');
      li.className = 'error';
      li.textContent = View.errorSentence(res && res.error);
      list.append(li);
      return;
    }
    if (res.sources.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No apps found. Open the app you want to record and press Refresh.';
      list.append(li);
      return;
    }
    for (const app of res.sources) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      const name = document.createElement('span');
      name.textContent = app.name;
      b.append(name);
      if (app.producingOutput) {
        const tag = document.createElement('span');
        tag.className = 'playing';
        tag.textContent = 'Playing';
        b.append(tag);
      }
      b.addEventListener('click', async () => {
        for (const other of list.querySelectorAll('button')) other.disabled = true;
        const out = await cap.start(app.id);
        if (out && out.ok === false) accept({ ...state, error: out.error });
      });
      li.append(b);
      list.append(li);
    }
  }

  $('stop').addEventListener('click', async () => {
    $('stop').disabled = true;
    await cap.stop();
    $('stop').disabled = false;
  });
  $('refresh').addEventListener('click', () => { void loadApps(); });
  $('folder').addEventListener('click', async () => {
    const out = await cap.chooseFolder();
    if (out && out.ok) accept(await cap.getState());
    void loadApps();
  });
  $('reveal').addEventListener('click', () => { void cap.revealLastTake(); });
  $('privacy').addEventListener('click', () => { void cap.openPrivacySettings(); });

  cap.onState(accept);
  // Notices the recording clock standing still. It never talks to the helper.
  setInterval(() => { if (state.phase === 'recording') render(); }, 500);

  (async () => {
    accept(await cap.getState());
    void loadApps();
  })();
}());
