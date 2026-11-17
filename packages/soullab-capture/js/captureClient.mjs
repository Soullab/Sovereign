// Soullab Capture — host-side client for control protocol v1.
//
// Intended to be imported by MAIA Desktop's main process in a later, separately
// authorized integration stage. Not wired into MAIA Desktop by this package.
//
// The host is strict: any message that is malformed, oversized, of an unknown kind, or
// from a different protocol version is a violation. On a violation the client closes the
// socket and calls `onViolation(reason)`; the supervisor must then kill the helper.

import net from 'node:net';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 64 * 1024;

export const ERROR_CODES = Object.freeze([
  'AUTH_FAILED', 'PROTOCOL_VIOLATION', 'INVALID_STATE', 'ALREADY_STARTING', 'INVALID_NAME',
  'NAME_EXISTS', 'OUTSIDE_ROOT', 'ROOT_INVALID', 'INSUFFICIENT_STORAGE', 'FORMAT_UNSUPPORTED',
  'SOURCE_NOT_FOUND', 'PERMISSION_DENIED', 'TAP_FAILED', 'IO_FAILED', 'WRITE_FAILED',
  'UNSUPPORTED_PLATFORM', 'INVALID_REQUEST',
]);

export const STATES = Object.freeze(['idle', 'prepared', 'starting', 'recording', 'finalizing']);
export const EVENT_KINDS = Object.freeze(['state', 'meter', 'discontinuity', 'storageLow', 'finalized', 'error']);
const REQUEST_TYPES = new Set(['listSources', 'prepare', 'start', 'stop', 'status', 'shutdown']);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const numberArray = (v) => Array.isArray(v) && v.every(isNumber);

/** Returns null when valid, otherwise a short reason. */
export function validateEvent(msg) {
  switch (msg.event) {
    case 'state':
      return STATES.includes(msg.state) && Number.isInteger(msg.generation) ? null : 'bad state event';
    case 'meter':
      return numberArray(msg.peak) && numberArray(msg.rms) && numberArray(msg.truePeak)
        && isNumber(msg.clipSamples) && isNumber(msg.seconds) ? null : 'bad meter event';
    case 'discontinuity':
      return typeof msg.kind === 'string' && isNumber(msg.framePosition) && isNumber(msg.lostFrames)
        ? null : 'bad discontinuity event';
    case 'storageLow':
      return isNumber(msg.availableBytes) ? null : 'bad storageLow event';
    case 'finalized':
      return validateTake(msg.take) ? null : 'bad finalized event';
    case 'error':
      return ERROR_CODES.includes(msg.code) ? null : 'unknown error code';
    default:
      return 'unknown event';
  }
}

export function validateTake(take) {
  return isObject(take)
    && typeof take.path === 'string' && typeof take.provenancePath === 'string'
    && typeof take.sha256 === 'string' && /^[0-9a-f]{64}$/.test(take.sha256)
    && isNumber(take.frames) && isNumber(take.sampleRate) && Number.isInteger(take.channels)
    && take.bitsPerSample === 24 && typeof take.stopReason === 'string' && typeof take.recovered === 'boolean';
}

/**
 * @param {object} options
 * @param {string} options.socketPath
 * @param {string} options.token
 * @param {(event: object) => void} [options.onEvent]
 * @param {(reason: string) => void} [options.onViolation]
 * @param {number} [options.requestTimeoutMs]
 */
export function createCaptureClient({
  socketPath, token, onEvent = () => {}, onViolation = () => {}, requestTimeoutMs = 10_000,
  connect = net.createConnection,
}) {
  let nextId = 1;
  let buffer = '';
  let violated = false;
  let closed = false;
  const pending = new Map();
  const socket = connect({ path: socketPath });
  socket.setEncoding('utf8');

  const failAll = (error) => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  };

  const violation = (reason) => {
    if (violated) return;
    violated = true;
    closed = true;
    socket.destroy();
    failAll(new Error(`protocol violation: ${reason}`));
    onViolation(reason);
  };

  const handleMessage = (msg) => {
    if (!isObject(msg)) return violation('message is not an object');
    if ('event' in msg) {
      const problem = validateEvent(msg);
      if (problem) return violation(problem);
      onEvent(msg);
      return;
    }
    if (!Number.isInteger(msg.id) || typeof msg.ok !== 'boolean') return violation('bad response');
    const entry = pending.get(msg.id);
    if (!entry) return violation('response to unknown request');
    pending.delete(msg.id);
    clearTimeout(entry.timer);
    if (msg.ok) {
      entry.resolve(msg.result);
    } else if (isObject(msg.error) && ERROR_CODES.includes(msg.error.code)) {
      const error = new Error(msg.error.code);
      error.code = msg.error.code;
      entry.reject(error);
    } else {
      entry.reject(new Error('protocol violation: unknown error code'));
      violation('unknown error code');
    }
  };

  socket.on('data', (chunk) => {
    if (violated) return;
    buffer += chunk;
    if (Buffer.byteLength(buffer, 'utf8') > MAX_MESSAGE_BYTES && !buffer.includes('\n')) {
      return violation('oversize message');
    }
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (Buffer.byteLength(line, 'utf8') > MAX_MESSAGE_BYTES) return violation('oversize message');
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return violation('malformed JSON');
      }
      handleMessage(msg);
      if (violated) return;
    }
  });

  socket.on('close', () => {
    closed = true;
    failAll(new Error('helper connection closed'));
  });
  socket.on('error', () => {});

  const send = (type, params = {}) => new Promise((resolve, reject) => {
    if (closed) return reject(new Error('helper connection closed'));
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout waiting for ${type}`));
      violation(`timeout waiting for ${type}`);
    }, requestTimeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.write(`${JSON.stringify({ ...params, id, type })}\n`);
  });

  const ready = new Promise((resolve, reject) => {
    socket.once('connect', () => {
      send('hello', { protocol: PROTOCOL_VERSION, token })
        .then((result) => {
          if (!isObject(result) || result.protocol !== PROTOCOL_VERSION) {
            violation('protocol version mismatch');
            reject(new Error('protocol version mismatch'));
            return;
          }
          resolve(result);
        })
        .catch(reject);
    });
    socket.once('error', reject);
  });

  return {
    ready,
    request(type, params) {
      if (!REQUEST_TYPES.has(type)) return Promise.reject(new Error(`unsupported request ${type}`));
      return send(type, params);
    },
    close() {
      closed = true;
      socket.end();
    },
    get violated() {
      return violated;
    },
  };
}
