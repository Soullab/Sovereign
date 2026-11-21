/**
 * Closed doors, honest — Proof (Review room).
 *
 * POST /api/sovereign/manuscripts/[id]/render answers 423 MEMBER_BOOK_EXPORT_HELD for every owned request
 * (memberBookExportRelease.ts is hard-off). The Proof tab used to offer "Make proof" anyway and then said
 * "The current manuscript could not be rendered as pages. Nothing about your Work changed." — a transient-failure
 * message for a refusal that a retry can never lift.
 *
 * Law under test: when the server-owned release capability (the same read the Publish room uses) says page files
 * are not certified, Proof does not offer to make one and says so plainly; and a 423 that arrives anyway is read as
 * "held", never as "try again". The certified path is unchanged.
 *
 * Mounts the REAL P4R1ProofView in jsdom; the capability read and the network are fictional doubles.
 *
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import { loadFromSource } from './support/loadFromSource';
import {
  MEMBER_BOOK_EXPORT_HELD_CODE,
  PAGE_PROOF_HELD_COPY,
  BOOK_FILES_HELD_COPY,
  isBookExportHeldRefusal,
} from '@/lib/writersStudio/heldDoorCopy';

const mockApiFetch = jest.fn();
let mockCaps: { settled: boolean; eligible: boolean; authority: Record<string, unknown> };

jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
jest.mock('@/lib/writersStudio/useWriterReleaseCapabilities', () => ({
  useWriterReleaseCapabilities: () => mockCaps,
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const VIEW = path.join(process.cwd(), 'app/dev/writers-studio-pc3-live/P4R1ProofView.tsx');
const HELD_COPY = "Page proofs aren't available yet. Your writing is unchanged.";
const GENERIC_RETRY = 'could not be rendered as pages';

const authority = (pdf: boolean) => ({
  manifestId: 'test', sourceIntakeReleased: true, importFormats: ['text'],
  exportsCertified: { pdf, epub: pdf }, permanentErasureCertified: false,
});
const PREFLIGHT = {
  ready: true, title: 'A fictional Work', sectionCount: 2, sourceAuthority: 'working_draft',
  sourceRevision: '3', issues: [], publicationBoundary: 'proof',
};

let postBodies: string[];
let nextPost: () => unknown;
let host: HTMLDivElement;
let root: Root;

function respond(status: number, json: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => json, headers: { get: () => null } };
}

function mount(mutate?: (src: string) => string) {
  const View = loadFromSource(VIEW, mutate).default as React.ComponentType<{ manuscriptId: string; workTitle: string }>;
  act(() => root.render(React.createElement(View, { manuscriptId: 'ms-1', workTitle: 'A fictional Work' })));
}
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
const makeProofButton = () =>
  Array.from(host.querySelectorAll('button')).find((b) => /Make proof/.test(b.textContent ?? '')) ?? null;
const text = () => host.textContent ?? '';

beforeEach(() => {
  postBodies = [];
  nextPost = () => respond(423, { error: 'PDF and EPUB delivery is not yet available.', code: 'MEMBER_BOOK_EXPORT_HELD' });
  mockCaps = { settled: true, eligible: true, authority: authority(false) };
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (_url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'POST') { postBodies.push(String(init.body)); return nextPost(); }
    return respond(200, PREFLIGHT);
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Named violations of the law for a held release; empty is conforming. */
async function heldViolations(): Promise<string[]> {
  const found: string[] = [];
  const button = makeProofButton();
  if (button && !button.disabled) found.push('make-proof-offered-while-held');
  if (!text().includes(HELD_COPY)) found.push('held-reason-not-shown');
  if (text().includes(GENERIC_RETRY)) found.push('generic-failure-copy-shown');
  return found;
}

describe('Proof — a held release is not offered as available', () => {
  it('does not offer Make proof when page files are not certified, and says so', async () => {
    mount();
    await settle();
    expect(await heldViolations()).toEqual([]);
    expect(postBodies).toEqual([]);
  });

  it('does not flash a held notice (or an offer) before the capability read has settled', async () => {
    mockCaps = { settled: false, eligible: false, authority: authority(false) };
    mount();
    await settle();
    const button = makeProofButton();
    expect(button === null || button.disabled).toBe(true);
    expect(text()).not.toContain(HELD_COPY);
  });

  it('reads a 423 that arrives anyway as held: no retry copy, no second attempt offered', async () => {
    mockCaps = { settled: true, eligible: true, authority: authority(true) }; // capability says certified, server disagrees
    mount();
    await settle();
    const button = makeProofButton();
    expect(button && !button.disabled).toBe(true);
    await act(async () => { button!.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(postBodies).toEqual([JSON.stringify({ format: 'pdf' })]);
    expect(await heldViolations()).toEqual([]);
  });

  it('leaves the certified path unchanged: a 500 is still a transient failure with the original words', async () => {
    mockCaps = { settled: true, eligible: true, authority: authority(true) };
    nextPost = () => respond(500, { error: 'boom' });
    mount();
    await settle();
    await act(async () => { makeProofButton()!.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(text()).toContain('The current manuscript could not be rendered as pages. Nothing about your Work changed.');
    expect(text()).not.toContain(HELD_COPY);
    const button = makeProofButton();
    expect(button && !button.disabled).toBe(true);
  });

  it('keeps the preflight facts the writer can still read while the proof is held', async () => {
    mount();
    await settle();
    expect(text()).toContain('2 sections');
    expect(text()).toContain('Proof, not publication');
  });
});

describe('lethality — each defeat candidate fails the checks on its named violation', () => {
  it('Make proof still offered while the capability read says held', async () => {
    mount((s) => s
      .replace('{proofsHeld ? (', '{false ? (')
      .replace('disabled={busy || !preflight || !proofsOpen}', 'disabled={busy || !preflight}'));
    await settle();
    expect(await heldViolations()).toContain('make-proof-offered-while-held');
  });

  it('no held reason shown (button hidden, nothing said)', async () => {
    mount((s) => s.replace('{PAGE_PROOF_HELD_COPY}', "{''}"));
    await settle();
    expect(await heldViolations()).toContain('held-reason-not-shown');
  });

  it('generic retry copy on a 423', async () => {
    mockCaps = { settled: true, eligible: true, authority: authority(true) };
    mount((s) => s.replace('isBookExportHeldRefusal(response.status, refusal)', 'false'));
    await settle();
    await act(async () => { makeProofButton()!.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(await heldViolations()).toContain('generic-failure-copy-shown');
  });
});

describe('the shared hold vocabulary matches the server and the copy the member is promised', () => {
  const renderRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/sovereign/manuscripts/[id]/render/route.ts'), 'utf8');

  it("the held code is the render route's own code", () => {
    expect(renderRoute).toContain(`code: '${MEMBER_BOOK_EXPORT_HELD_CODE}'`);
  });

  it('the member-facing words are exactly the sentences specified for this fix', () => {
    expect(PAGE_PROOF_HELD_COPY).toBe(HELD_COPY);
    expect(BOOK_FILES_HELD_COPY).toBe("PDF and EPUB copies of your book aren't available yet. Your writing is unchanged.");
  });

  it('a hold is recognised by status or by code; an ordinary failure or a changed-writing 409 is not a hold', () => {
    expect(isBookExportHeldRefusal(423, null)).toBe(true);
    expect(isBookExportHeldRefusal(500, { code: MEMBER_BOOK_EXPORT_HELD_CODE })).toBe(true);
    expect(isBookExportHeldRefusal(500, { error: 'boom' })).toBe(false);
    expect(isBookExportHeldRefusal(409, { error: 'Your writing changed since the production check.' })).toBe(false);
    expect(isBookExportHeldRefusal(404, null)).toBe(false);
  });
});
