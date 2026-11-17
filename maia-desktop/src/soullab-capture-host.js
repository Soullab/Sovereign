// MAIA Desktop — host for the Soullab Capture helper. SOULLAB-CAPTURE J4a-1.
//
// Owner: LISTEN-01 #1979 (Desktop #1892). The engine is the existing package
// `packages/soullab-capture`; this file only supervises it. There is no second
// recorder, playback engine or application here.
//
// What this host guarantees:
//   · One helper process per take, launched through LaunchServices (`open -n`) so
//     macOS attributes the system-audio permission to the helper, not to MAIA.
//   · A private 0700 socket directory and a 0600 one-time token per launch.
//   · The protocol is the package's own client. Any violation closes the
//     connection AND terminates the helper — a helper that has drifted from the
//     protocol is never trusted again.
//   · Nothing starts by itself. No auto-start, no auto-resume, no retry after a
//     failure: every take begins with an explicit member action.
//   · Takes are written only to the folder the member chose. The surface sees the
//     folder's name and the take's file name — never another location.
//
// This module never imports Electron, so it can be tested in plain Node.

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const SOURCE_ID = /^pid:\d{1,10}$/;
const PHASES = Object.freeze(['idle', 'launching', 'starting', 'recording', 'finalizing']);
// System audio daemons are never offered as something a member records.
const SYSTEM_SOURCE = /^com\.apple\.(audio|coreaudio|AirPlay|mediaremoted)/;
const METER_EMIT_MS = 500;

function defaultLaunch(helperApp, args) {
  return new Promise((resolve, reject) => {
    // -n: a fresh instance per take. -g: never steal focus from the member.
    execFile('/usr/bin/open', ['-n', '-g', helperApp, '--args', ...args], (error) => {
      if (error) reject(new Error('HELPER_LAUNCH_FAILED'));
      else resolve();
    });
  });
}

function defaultFindPids(socketPath) {
  return new Promise((resolve) => {
    execFile('/usr/bin/pgrep', ['-f', '--', socketPath], (_error, stdout) => {
      resolve(String(stdout || '').split('\n').map(Number).filter((n) => Number.isInteger(n) && n > 0));
    });
  });
}

/** The take name the helper is asked to use: a timestamp, never member text. */
function takeNameFor(date, attempt = 0) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} `
    + `${p(date.getHours())}.${p(date.getMinutes())}.${p(date.getSeconds())}`;
  return attempt === 0 ? `Soullab Capture ${stamp}` : `Soullab Capture ${stamp} (${attempt + 1})`;
}

/** Sources a member may choose: named apps producing output, never system daemons. */
function offerableSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((s) => s && typeof s.id === 'string' && SOURCE_ID.test(s.id))
    .filter((s) => typeof s.name === 'string' && s.name.length > 0)
    .filter((s) => !SYSTEM_SOURCE.test(String(s.bundleID || '')))
    .map((s) => ({ id: s.id, name: s.name.slice(0, 80), producingOutput: s.producingOutput === true }))
    .sort((a, b) => Number(b.producingOutput) - Number(a.producingOutput) || a.name.localeCompare(b.name));
}

/**
 * The member's chosen folder, remembered in a small JSON file under userData.
 * A folder that no longer exists or is not writable reads as "not chosen" — the
 * host never silently falls back to some other location.
 */
function createFolderStore({ file, fsImpl = fs }) {
  const read = () => {
    try {
      const value = JSON.parse(fsImpl.readFileSync(file, 'utf8')).folder;
      if (typeof value !== 'string' || !path.isAbsolute(value)) return null;
      if (!fsImpl.statSync(value).isDirectory()) return null;
      fsImpl.accessSync(value, fs.constants.W_OK);
      return value;
    } catch {
      return null;
    }
  };
  return {
    get: read,
    set(folder) {
      if (typeof folder !== 'string' || !path.isAbsolute(folder)) throw new Error('FOLDER_INVALID');
      fsImpl.mkdirSync(path.dirname(file), { recursive: true });
      fsImpl.writeFileSync(file, `${JSON.stringify({ folder })}\n`, { mode: 0o600 });
      if (read() !== folder) throw new Error('FOLDER_INVALID');
      return folder;
    },
  };
}

function createSoullabCaptureHost({
  helperApp,
  loadClient,
  getFolder,
  launch = defaultLaunch,
  findPids = defaultFindPids,
  kill = (pid, signal) => process.kill(pid, signal),
  tmpdir = () => os.tmpdir(),
  now = () => new Date(),
  onChange = () => {},
  logger = () => {},
  socketWaitMs = 20_000,
  requestTimeoutMs = 120_000, // `start` may wait on the member answering the permission prompt
  existsSync = fs.existsSync,
}) {
  let phase = 'idle';
  let session = null; // { client, socketPath, dir }
  let source = null;
  let meter = { seconds: 0, peak: [] };
  let discontinuities = 0;
  let lastTake = null;
  let lastError = null;
  let lastMeterEmit = 0;
  let finalizing = null;

  const snapshot = () => ({
    phase,
    source: source ? { name: source.name } : null,
    seconds: Math.round(meter.seconds * 10) / 10,
    peak: meter.peak.slice(0, 2),
    discontinuities,
    lastTake,
    error: lastError,
  });
  const emit = () => { try { onChange(snapshot()); } catch { /* the surface never breaks the host */ } };
  const setPhase = (next) => {
    if (!PHASES.includes(next)) throw new Error(`bad phase ${next}`);
    phase = next;
    emit();
  };

  async function terminateHelper(s) {
    try {
      for (const pid of await findPids(s.socketPath)) {
        try { kill(pid, 'SIGTERM'); } catch { /* already gone */ }
      }
    } catch { /* nothing to terminate */ }
  }

  function removeDir(s) {
    try { fs.rmSync(s.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  async function closeSession({ shutdown }) {
    const s = session;
    session = null;
    if (!s) return;
    if (shutdown && s.client && !s.client.violated) {
      try { await s.client.request('shutdown'); } catch { /* helper may already be exiting */ }
    }
    try { s.client?.close(); } catch { /* closed */ }
    removeDir(s);
  }

  function recordTake(take) {
    if (!take || typeof take !== 'object') return;
    lastTake = {
      fileName: path.basename(String(take.path || '')),
      seconds: take.sampleRate ? Math.round((take.frames / take.sampleRate) * 10) / 10 : 0,
      stopReason: String(take.stopReason || 'unknown'),
      sha256: typeof take.sha256 === 'string' ? take.sha256 : null,
    };
  }

  function onEvent(e) {
    switch (e.event) {
      case 'state':
        if (e.state === 'recording' && phase === 'starting') setPhase('recording');
        break;
      case 'meter': {
        meter = { seconds: Number(e.seconds) || 0, peak: Array.isArray(e.peak) ? e.peak : [] };
        const t = Date.now();
        if (t - lastMeterEmit >= METER_EMIT_MS) { lastMeterEmit = t; emit(); }
        break;
      }
      case 'discontinuity':
        discontinuities += 1;
        emit();
        break;
      case 'finalized':
        // The helper ended the take by itself (source quit, sleep, ...). Close
        // this helper; nothing restarts.
        recordTake(e.take);
        // During a member Stop, stop() owns the teardown; only a take the helper
        // ended by itself is closed from here.
        if (!finalizing && (phase === 'starting' || phase === 'recording')) {
          setPhase('finalizing');
          finalizing = closeSession({ shutdown: true }).finally(() => {
            finalizing = null;
            source = null;
            setPhase('idle');
          });
        }
        break;
      case 'error':
        lastError = String(e.code || 'HELPER_ERROR');
        emit();
        break;
      default:
        break;
    }
  }

  async function openSession(folder) {
    const dir = fs.mkdtempSync(path.join(tmpdir(), 'slcap-'));
    fs.chmodSync(dir, 0o700);
    const tokenFile = path.join(dir, 'token');
    const token = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(tokenFile, token, { mode: 0o600, flag: 'wx' });
    const socketPath = path.join(dir, 's');
    const s = { dir, socketPath, client: null };
    try {
      await launch(helperApp, ['--root', folder, '--socket', socketPath, '--token-file', tokenFile]);
      const deadline = Date.now() + socketWaitMs;
      while (!existsSync(socketPath)) {
        if (Date.now() > deadline) throw new Error('HELPER_NOT_READY');
        await new Promise((r) => setTimeout(r, 50));
      }
      const { createCaptureClient } = await loadClient();
      s.client = createCaptureClient({
        socketPath,
        token,
        requestTimeoutMs,
        onEvent: (e) => { if (session === s) onEvent(e); },
        onViolation: (reason) => {
          logger({ event: 'soullab_capture_violation', reason: String(reason).slice(0, 64) });
          void terminateHelper(s);
          if (session === s) {
            session = null;
            removeDir(s);
            lastError = 'PROTOCOL_VIOLATION';
            source = null;
            setPhase('idle');
          }
        },
      });
      await s.client.ready;
      session = s;
      return s;
    } catch (error) {
      try { s.client?.close(); } catch { /* closed */ }
      await terminateHelper(s);
      removeDir(s);
      throw error;
    }
  }

  const fail = (code) => {
    const error = new Error(code);
    error.code = code;
    return error;
  };

  return {
    snapshot,
    active: () => phase !== 'idle',

    /** Opens a short-lived helper only to read the list, then lets it go. */
    async listSources() {
      if (phase !== 'idle') throw fail('BUSY');
      const folder = getFolder();
      if (!folder) throw fail('NO_FOLDER');
      setPhase('launching');
      try {
        const s = await openSession(folder);
        const { sources } = await s.client.request('listSources');
        return offerableSources(sources);
      } catch (error) {
        throw fail(error.code || error.message || 'LIST_FAILED');
      } finally {
        await closeSession({ shutdown: true });
        if (phase === 'launching') setPhase('idle');
      }
    },

    /** One explicit member action starts one take. */
    async start(sourceId) {
      if (typeof sourceId !== 'string' || !SOURCE_ID.test(sourceId)) throw fail('INVALID_SOURCE');
      if (phase !== 'idle') throw fail('BUSY');
      const folder = getFolder();
      if (!folder) throw fail('NO_FOLDER');
      lastError = null;
      discontinuities = 0;
      meter = { seconds: 0, peak: [] };
      setPhase('launching');
      try {
        const s = await openSession(folder);
        const { sources } = await s.client.request('listSources');
        const chosen = (sources || []).find((x) => x.id === sourceId);
        if (!chosen) throw fail('SOURCE_NOT_FOUND');
        source = { name: String(chosen.name || 'App').slice(0, 80) };
        const when = now();
        for (let attempt = 0; ; attempt++) {
          try {
            await s.client.request('prepare', { sourceId, takeName: takeNameFor(when, attempt), channels: 2 });
            break;
          } catch (error) {
            if (error.code !== 'NAME_EXISTS' || attempt >= 8) throw error;
          }
        }
        setPhase('starting');
        await s.client.request('start');
        return snapshot();
      } catch (error) {
        lastError = error.code || error.message || 'START_FAILED';
        source = null;
        await closeSession({ shutdown: true });
        setPhase('idle');
        throw fail(lastError);
      }
    },

    /** Member Stop. Finalizes the take and lets the helper exit. */
    async stop() {
      if (finalizing) { await finalizing; return snapshot(); }
      if (!session || (phase !== 'starting' && phase !== 'recording')) throw fail('NOT_RECORDING');
      setPhase('finalizing');
      try {
        const result = await session.client.request('stop');
        recordTake(result && result.take);
      } catch (error) {
        lastError = error.code || error.message || 'STOP_FAILED';
      } finally {
        await closeSession({ shutdown: true });
        source = null;
        setPhase('idle');
      }
      return snapshot();
    },

    /** App quit: finalize anything in progress, bounded, then make sure no helper outlives MAIA. */
    async shutdown({ timeoutMs = 8_000 } = {}) {
      const s = session;
      if (!s && !finalizing) return;
      const work = phase === 'starting' || phase === 'recording' ? this.stop() : (finalizing || closeSession({ shutdown: true }));
      await Promise.race([work.catch(() => {}), new Promise((r) => setTimeout(r, timeoutMs))]);
      if (s) await terminateHelper(s);
    },
  };
}

module.exports = {
  createSoullabCaptureHost,
  createFolderStore,
  offerableSources,
  takeNameFor,
  SOURCE_ID,
};
