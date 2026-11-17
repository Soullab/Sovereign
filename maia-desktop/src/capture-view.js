// MAIA Desktop — what the Capture window says. SOULLAB-CAPTURE J4a-2.
//
// Pure presentation logic: given the host snapshot (and when the clock last
// moved), decide the words and the mode. No DOM, no Electron, no clock of its
// own — so every sentence a member reads is tested, not eyeballed.
//
// Doctrine: say plainly what is true. "Waiting for audio" is a state, not an
// error. A recording that ended by itself says why, and that it did not
// restart. An empty take is labelled, never hidden (founder ruling J4a-2).

(function attach(root) {
  'use strict';

  const WAITING_AFTER_MS = 2000;

  const STOP_REASONS = Object.freeze({
    memberStop: () => 'You stopped the recording.',
    sourceExited: (app) => `${app || 'The app'} quit, so the recording ended.`,
    deviceChanged: () => 'Your sound output changed — for example headphones connecting or disconnecting — so the recording ended. It did not restart.',
    sleep: () => 'Your Mac went to sleep, so the recording ended. It did not restart.',
    terminated: () => 'MAIA closed, so the recording ended.',
    clientDisconnected: () => 'The connection to the recorder closed, so the recording ended.',
  });

  const ERRORS = Object.freeze({
    PERMISSION_DENIED: 'macOS has not allowed Soullab Capture to record system audio.',
    NO_FOLDER: 'Choose a folder for your recordings first.',
    ROOT_INVALID: 'Your recordings folder is not available. Choose it again.',
    SOURCE_NOT_FOUND: 'That app is no longer running. Refresh the list and choose again.',
    INSUFFICIENT_STORAGE: 'There is not enough free space in your recordings folder.',
    HELPER_LAUNCH_FAILED: 'The recorder could not start.',
    HELPER_NOT_READY: 'The recorder did not respond in time.',
    PROTOCOL_VIOLATION: 'The recorder stopped responding correctly, so it was closed. Nothing restarts by itself.',
    BUSY: 'A recording is already in progress.',
    TOO_SOON: 'One moment — then press Refresh again.',
  });

  function stopSentence(take) {
    if (!take) return '';
    if (take.empty) return `Nothing was recorded — ${take.appName || 'the app'} wasn't playing.`;
    if (take.silent) return `Saved, but it is silent: ${take.appName || 'the app'} sent no sound the whole time. Check that it was playing and that its own volume is up.`;
    const fn = STOP_REASONS[take.stopReason];
    return fn ? fn(take.appName) : 'The recording ended.';
  }

  function errorSentence(code) {
    if (!code) return '';
    return ERRORS[code] || 'Something went wrong, and nothing was recorded.';
  }

  function clock(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }

  /** Linear peak (0..1) → bar fraction over −60..0 dBFS. */
  function meterFraction(peak) {
    const v = Number(peak) || 0;
    if (v <= 0) return 0;
    const db = 20 * Math.log10(Math.min(1, v));
    return Math.max(0, Math.min(1, (db + 60) / 60));
  }

  function rateLabel(rate) {
    if (!rate) return '';
    return Number.isInteger(rate / 1000) ? `${rate / 1000} kHz` : `${(rate / 1000).toFixed(1)} kHz`;
  }

  /**
   * @param {object} state  host snapshot as sent by main
   * @param {{now:number, lastAdvanceAt:number}} clockInfo  when the recording clock last moved
   */
  function describe(state, { now, lastAdvanceAt, lastSoundAt } = {}) {
    const s = state || {};
    const app = s.source && s.source.name;
    const view = {
      mode: 'idle',
      headline: 'Record one app',
      detail: 'Choose an app that is playing. Only that app\'s sound is recorded, until you stop.',
      recording: false,
      time: '',
      meter: [meterFraction(s.peak && s.peak[0]), meterFraction(s.peak && s.peak[1])],
      gaps: Number(s.discontinuities) || 0,
      canChoose: s.phase === 'idle',
      error: errorSentence(s.error),
      permissionHelp: s.error === 'PERMISSION_DENIED',
      folder: s.folderName || null,
      folderNote: s.folderExternal
        ? 'This folder is on another drive. macOS will also ask to let Soullab Capture use it.'
        : '',
      lastTake: null,
      recovery: '',
    };
    if (!s.folderName && s.phase === 'idle') {
      view.detail = 'First, choose a folder for your recordings. They are saved only there, on this Mac.';
    }
    if (s.recovery && (s.recovery.repaired || s.recovery.quarantined)) {
      const parts = [];
      if (s.recovery.repaired) parts.push(`repaired ${s.recovery.repaired} recording${s.recovery.repaired === 1 ? '' : 's'} that ${s.recovery.repaired === 1 ? 'was' : 'were'} interrupted earlier`);
      if (s.recovery.quarantined) parts.push(`set aside ${s.recovery.quarantined} it could not repair (nothing was deleted)`);
      view.recovery = `Soullab Capture ${parts.join(' and ')}. ${s.recovery.repaired ? 'They are in your folder.' : ''}`.trim();
    }
    switch (s.phase) {
      case 'launching':
        view.mode = 'busy';
        view.headline = 'Getting ready…';
        view.detail = '';
        break;
      case 'starting':
        view.mode = 'starting';
        view.recording = true;
        view.headline = `Starting to record ${app || 'the app'}…`;
        view.detail = 'If macOS asks, choose Allow. Nothing is recorded until you do.';
        break;
      case 'recording': {
        view.recording = true;
        view.time = clock(s.seconds);
        const stalled = Number.isFinite(now) && Number.isFinite(lastAdvanceAt) && now - lastAdvanceAt >= WAITING_AFTER_MS;
        const hushed = !stalled && Number.isFinite(now) && Number.isFinite(lastSoundAt) && now - lastSoundAt >= WAITING_AFTER_MS;
        if (hushed) {
          // The clock moves, so audio is arriving — but all of it is silence.
          view.mode = 'waiting';
          view.headline = `${app || 'The app'} is silent right now`;
          view.detail = `Recording, but no sound is coming from ${app || 'the app'}. Check that it is playing and that its own volume is up.`;
        } else if (stalled) {
          view.mode = 'waiting';
          view.headline = `Waiting for audio from ${app || 'the app'}`;
          view.detail = `Recording, but ${app || 'the app'} isn't sending any sound right now. Press play there, or stop here.`;
        } else {
          view.mode = 'recording';
          view.headline = `Recording ${app || 'the app'}`;
          view.detail = 'Only this app\'s sound is being recorded.';
        }
        break;
      }
      case 'finalizing':
        view.mode = 'busy';
        view.recording = true;
        view.headline = 'Saving…';
        view.detail = 'Finishing the file and checking it.';
        break;
      default:
        break;
    }
    if (s.lastTake && s.phase === 'idle') {
      view.lastTake = {
        name: s.lastTake.fileName,
        length: clock(s.lastTake.seconds),
        rate: rateLabel(s.lastTake.sampleRate),
        gaps: Number(s.lastTake.gaps) || 0,
        empty: !!s.lastTake.empty,
        silent: !!s.lastTake.silent,
        sentence: stopSentence(s.lastTake),
      };
    }
    return view;
  }

  // The app list is refreshed after a RECORDING ends — never after the act of
  // listing itself, which also passes through a busy phase. (J4a-2 witness:
  // treating "listing finished" as "recording finished" re-listed forever and
  // launched the helper 287 times in a minute.)
  const RECORDING_PHASES = new Set(['starting', 'recording', 'finalizing']);
  function shouldReloadApps(prevPhase, nextPhase) {
    return RECORDING_PHASES.has(prevPhase) && nextPhase === 'idle';
  }

  const api = { describe, shouldReloadApps, stopSentence, errorSentence, clock, meterFraction, rateLabel, WAITING_AFTER_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CaptureView = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
