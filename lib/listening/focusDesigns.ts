/**
 * FOCUS DESIGNS — a member's saved Focus Field designs, kept in THIS browser on THIS device, with a
 * passphrase-encrypted file to back them up or move them. Owner LISTEN-01 #1979; founder approval
 * 2026-11-19 ("Like the Shelf- combined with option (on my device").
 *
 * A design is exactly the existing SOULLAB_FOCUS_FIELD_COMBINATION_V1 record (focusFieldSession.ts):
 * name, activity kind, support, musical world, stimulation and duration. It never holds the free-text
 * task label, feedback, session history or anything heard. Nothing here touches a server, MAIA or audio.
 *
 * The encrypted file follows the Shelf's design (receptiveFieldBackup.ts): PBKDF2-SHA256 600,000 rounds,
 * AES-256-GCM with associated data, and every unlocked record revalidated. It is a separate copy of that
 * pattern, not a shared module, because the Shelf is outside this mandate. Held, like the Shelf's, for
 * independent cryptography review before a real member release.
 */
import {
  FOCUS_FIELD_COMBINATION_FORMAT, FOCUS_MUSICAL_WORLDS, FOCUS_NEEDS, FOCUS_STIMULATION_LEVELS,
  FOCUS_TASK_KINDS, validateFocusDuration,
  type FocusDuration, type FocusMusicalWorld, type FocusNeed, type FocusSavedCombination,
  type FocusStimulation, type FocusTaskKind,
} from './focusFieldSession';

export type FocusDesign = FocusSavedCombination;

export const FOCUS_DESIGNS_STORAGE_KEY = 'soullab.listen.focus.designs.v1';
export const FOCUS_DESIGNS_FORMAT = 'SOULLAB_FOCUS_DESIGNS_V1';
export const FOCUS_DESIGNS_MAX = 24;
const NAME_MAX = 60;
const ID = /^[a-z0-9][a-z0-9_-]{7,63}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const DESIGN_KEYS = ['format', 'id', 'name', 'task', 'focusNeed', 'musicalWorld', 'stimulation', 'duration', 'savedAt'];

function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error(`${label} is not supported.`);
  return value as T;
}

function cleanName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Give this design a name.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Give this design a name.');
  if (CONTROL.test(name)) throw new Error('The name contains characters that cannot be saved.');
  if (name.length > NAME_MAX) throw new Error(`Names are up to ${NAME_MAX} characters.`);
  return name;
}

/** Revalidates a design from any source (this browser, an unlocked file). Unknown fields are refused. */
export function validateFocusDesign(input: unknown): FocusDesign {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Not a focus design.');
  const v = input as Record<string, unknown>;
  if (Object.keys(v).some((k) => !DESIGN_KEYS.includes(k))) throw new Error('A focus design holds only its own choices.');
  if (v.format !== FOCUS_FIELD_COMBINATION_FORMAT) throw new Error('Not a focus design.');
  if (typeof v.id !== 'string' || !ID.test(v.id)) throw new Error('A focus design needs an opaque id.');
  const savedAt = typeof v.savedAt === 'string' ? new Date(v.savedAt) : null;
  if (!savedAt || !Number.isFinite(savedAt.getTime())) throw new Error('A focus design needs a save time.');
  return {
    format: FOCUS_FIELD_COMBINATION_FORMAT,
    id: v.id,
    name: cleanName(v.name),
    task: choice<FocusTaskKind>(v.task, FOCUS_TASK_KINDS, 'Activity'),
    focusNeed: choice<FocusNeed>(v.focusNeed, FOCUS_NEEDS, 'Support'),
    musicalWorld: choice<FocusMusicalWorld>(v.musicalWorld, FOCUS_MUSICAL_WORLDS, 'Musical world'),
    stimulation: choice<FocusStimulation>(v.stimulation, FOCUS_STIMULATION_LEVELS, 'Stimulation'),
    duration: validateFocusDuration(v.duration),
    savedAt: savedAt.toISOString(),
  };
}

export function newFocusDesign(p: {
  name: string; task: FocusTaskKind; focusNeed: FocusNeed; musicalWorld: FocusMusicalWorld;
  stimulation: FocusStimulation; duration: FocusDuration; id: string; at: Date | string;
}): FocusDesign {
  return validateFocusDesign({
    format: FOCUS_FIELD_COMBINATION_FORMAT, id: p.id, name: p.name, task: p.task, focusNeed: p.focusNeed,
    musicalWorld: p.musicalWorld, stimulation: p.stimulation, duration: { ...p.duration },
    savedAt: new Date(p.at).toISOString(),
  });
}

function validateList(input: unknown): FocusDesign[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Not a list of focus designs.');
  const v = input as { format?: unknown; designs?: unknown };
  if (v.format !== FOCUS_DESIGNS_FORMAT || !Array.isArray(v.designs)) throw new Error('Not a list of focus designs.');
  if (v.designs.length > FOCUS_DESIGNS_MAX) throw new Error(`A list holds up to ${FOCUS_DESIGNS_MAX} designs.`);
  const designs = v.designs.map(validateFocusDesign);
  if (new Set(designs.map((d) => d.id)).size !== designs.length) throw new Error('A design appears twice.');
  return designs;
}

export function serializeFocusDesigns(designs: readonly FocusDesign[]): string {
  return JSON.stringify({ format: FOCUS_DESIGNS_FORMAT, designs: validateList({ format: FOCUS_DESIGNS_FORMAT, designs }) });
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Reads this browser's saved designs. `available: false` when storage is blocked (private window,
 * blocked site data): the desk then keeps designs for this visit only and says so. A stored list that
 * fails validation is reported and left untouched until the member saves or forgets.
 */
export function readFocusDesigns(storage: Store | null | undefined): { designs: FocusDesign[]; available: boolean; problem: string | null } {
  if (!storage) return { designs: [], available: false, problem: null };
  let raw: string | null;
  try { raw = storage.getItem(FOCUS_DESIGNS_STORAGE_KEY); } catch { return { designs: [], available: false, problem: null }; }
  if (raw === null) return { designs: [], available: true, problem: null };
  try { return { designs: validateList(JSON.parse(raw)), available: true, problem: null }; }
  catch { return { designs: [], available: true, problem: 'The designs saved in this browser could not be read. Saving a new design replaces them.' }; }
}

/** True when written. An empty list removes the key, so "Forget all" leaves nothing behind. */
export function writeFocusDesigns(storage: Store | null | undefined, designs: readonly FocusDesign[]): boolean {
  if (!storage) return false;
  try {
    if (designs.length === 0) storage.removeItem(FOCUS_DESIGNS_STORAGE_KEY);
    else storage.setItem(FOCUS_DESIGNS_STORAGE_KEY, serializeFocusDesigns(designs));
    return true;
  } catch { return false; }
}

// ── Passphrase-encrypted file ────────────────────────────────────────────────────────────────────────
export const FOCUS_DESIGNS_PRIVATE_FORMAT = 'SOULLAB_FOCUS_DESIGNS_PRIVATE_V1';
export const MAX_FOCUS_DESIGNS_PRIVATE_BYTES = 64 * 1024;
const PLAIN_MAX = 32 * 1024;
const KDF_ITERATIONS = 600_000, SALT_BYTES = 16, IV_BYTES = 12, TAG_BYTES = 16;
const AAD = 'SOULLAB_FOCUS_DESIGNS_PRIVATE_AAD_V1';
const UNRECOGNIZED = 'This is not a Soullab focus designs file.';
type Envelope = { format: typeof FOCUS_DESIGNS_PRIVATE_FORMAT; version: 1; kdf: 'PBKDF2-SHA256-600000'; cipher: 'AES-256-GCM'; salt: string; iv: string; ciphertext: string };

const utf8 = (s: string) => new TextEncoder().encode(s);
function requirePassphrase(value: string) {
  if (typeof value !== 'string' || value.length < 12 || utf8(value).length > 1024)
    throw new Error('Use a private passphrase of 12 or more characters (1024 bytes maximum).');
}
function webCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.getRandomValues)
    throw new Error('Encrypted designs need a secure browser context (HTTPS or localhost).');
  return crypto;
}
function toBase64(data: Uint8Array): string {
  let s = ''; for (let o = 0; o < data.length; o += 8192) s += String.fromCharCode(...data.subarray(o, o + 8192));
  return btoa(s);
}
function fromBase64(value: unknown, maxBytes: number): Uint8Array {
  if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 + 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(UNRECOGNIZED);
  let s: string; try { s = atob(value); } catch { throw new Error(UNRECOGNIZED); }
  if (s.length > maxBytes) throw new Error(UNRECOGNIZED);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function keyFor(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const c = webCrypto();
  const base = await c.subtle.importKey('raw', utf8(passphrase), 'PBKDF2', false, ['deriveKey']);
  return c.subtle.deriveKey({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptFocusDesigns(designs: readonly FocusDesign[], passphrase: string): Promise<string> {
  requirePassphrase(passphrase);
  const plain = serializeFocusDesigns(designs);
  if (utf8(plain).length > PLAIN_MAX) throw new Error('Too many designs for one file.');
  const c = webCrypto();
  const salt = c.getRandomValues(new Uint8Array(SALT_BYTES)), iv = c.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: utf8(AAD) },
    await keyFor(passphrase, salt), utf8(plain)));
  const envelope: Envelope = { format: FOCUS_DESIGNS_PRIVATE_FORMAT, version: 1, kdf: 'PBKDF2-SHA256-600000', cipher: 'AES-256-GCM',
    salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(sealed) };
  return JSON.stringify(envelope);
}

export async function decryptFocusDesigns(wrapped: string, passphrase: string): Promise<FocusDesign[]> {
  requirePassphrase(passphrase);
  if (typeof wrapped !== 'string' || utf8(wrapped).length > MAX_FOCUS_DESIGNS_PRIVATE_BYTES) throw new Error(UNRECOGNIZED);
  let input: unknown; try { input = JSON.parse(wrapped); } catch { throw new Error(UNRECOGNIZED); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(UNRECOGNIZED);
  const e = input as Partial<Envelope>;
  if (e.format !== FOCUS_DESIGNS_PRIVATE_FORMAT || e.version !== 1 || e.kdf !== 'PBKDF2-SHA256-600000' || e.cipher !== 'AES-256-GCM')
    throw new Error(UNRECOGNIZED);
  const salt = fromBase64(e.salt, SALT_BYTES), iv = fromBase64(e.iv, IV_BYTES), ciphertext = fromBase64(e.ciphertext, PLAIN_MAX + TAG_BYTES);
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || ciphertext.length <= TAG_BYTES) throw new Error(UNRECOGNIZED);
  let plain: string;
  try {
    const bytes = await webCrypto().subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: utf8(AAD) },
      await keyFor(passphrase, salt), new Uint8Array(ciphertext));
    plain = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { throw new Error('Unable to unlock this file. The passphrase or file may be incorrect.'); }
  return validateList(JSON.parse(plain)); // authenticated, and still revalidated
}
