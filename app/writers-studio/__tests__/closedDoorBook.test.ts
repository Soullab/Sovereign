/**
 * Closed doors, honest — "Your Book" (legacy Press room) and the Home door to Sources.
 *
 * The same render route answers 423 MEMBER_BOOK_EXPORT_HELD for every owned request. The legacy "Your Book" tab
 * offered Download PDF / Download EPUB and, on the refusal, said "Could not make your book just now. Please try
 * again in a moment." A retry can never succeed, so the writer was told something false.
 *
 * Law under test: when the server-owned release capability says PDF and EPUB are not certified, the tab offers no
 * download and says so plainly; a 423 that arrives anyway reads as "held", never "try again". Certified path unchanged.
 *
 * Mounts the REAL page in jsdom; the capability read, the network and the CodeMirror editor are fictional doubles.
 *
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';
import { loadFromSource } from './support/loadFromSource';

const mockApiFetch = jest.fn();
let mockCaps: { settled: boolean; eligible: boolean; authority: Record<string, unknown> };

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('tab=book&m=ms-1') }));
jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
jest.mock('@/lib/writersStudio/useWriterReleaseCapabilities', () => ({
  useWriterReleaseCapabilities: () => mockCaps,
}));
jest.mock('@/app/press/manuscript/WorkingDraftEditor', () => ({ __esModule: true, default: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const PAGE = path.join(process.cwd(), 'app/press/manuscript/page.tsx');
const HOME_VIEW = path.join(process.cwd(), 'app/dev/writers-studio-pc3-live/P4R1HomeView.tsx');
const HELD_COPY = "PDF and EPUB copies of your book aren't available yet. Your writing is unchanged.";
const RETRY_COPY = 'Could not make your book just now. Please try again in a moment.';

const authority = (certified: boolean) => ({
  manifestId: 'test', sourceIntakeReleased: true, importFormats: ['text'],
  exportsCertified: { pdf: certified, epub: certified }, permanentErasureCertified: false,
});

let nextPost: () => unknown;
let postedFormats: string[];
let host: HTMLDivElement;
let root: Root;

function respond(status: number, json: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => json, blob: async () => new Blob([]) };
}

async function mount(mutate?: (src: string) => string) {
  const Page = loadFromSource(PAGE, mutate).default as React.ComponentType;
  await act(async () => { root.render(React.createElement(Page)); });
  // list, then detail, then the capability read settles
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
}
const text = () => host.textContent ?? '';
const downloadButtons = () =>
  Array.from(host.querySelectorAll('button')).filter((b) => /Download (PDF|EPUB)/.test(b.textContent ?? ''));

beforeEach(() => {
  localStorage.clear();
  postedFormats = [];
  nextPost = () => respond(423, { error: 'PDF and EPUB delivery is not yet available.', code: 'MEMBER_BOOK_EXPORT_HELD' });
  mockCaps = { settled: true, eligible: true, authority: authority(false) };
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
    if (/\/render$/.test(url) && init?.method === 'POST') {
      postedFormats.push((JSON.parse(String(init.body)) as { format: string }).format);
      return nextPost();
    }
    if (url === '/api/sovereign/manuscripts') return respond(200, { manuscripts: [{ id: 'ms-1', title: 'A fictional Work' }] });
    if (/\/api\/sovereign\/manuscripts\/ms-1$/.test(url)) {
      return respond(200, {
        manuscript: { title: 'A fictional Work' },
        sections: [{ id: 's1', position: 0, heading: 'One', chars: 3600 }],
        keeps: [], collections: [],
      });
    }
    return respond(200, {});
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
function heldViolations(): string[] {
  const found: string[] = [];
  if (downloadButtons().some((b) => !b.disabled)) found.push('download-offered-while-held');
  if (!text().includes(HELD_COPY)) found.push('held-reason-not-shown');
  if (text().includes(RETRY_COPY)) found.push('retry-copy-shown-for-a-refusal-a-retry-cannot-lift');
  return found;
}

describe('Your Book — a held release is not offered as available', () => {
  it('offers no download when PDF and EPUB are not certified, and says so', async () => {
    await mount();
    expect(heldViolations()).toEqual([]);
    expect(postedFormats).toEqual([]);
  });

  it('does not flash a held notice before the capability read has settled', async () => {
    mockCaps = { settled: false, eligible: false, authority: authority(false) };
    await mount();
    expect(text()).not.toContain(HELD_COPY);
    expect(downloadButtons().every((b) => b.disabled)).toBe(true);
  });

  it('reads a 423 that arrives anyway as held, with no retry copy', async () => {
    mockCaps = { settled: true, eligible: true, authority: authority(true) };
    await mount();
    const pdf = downloadButtons().find((b) => /PDF/.test(b.textContent ?? ''))!;
    expect(pdf.disabled).toBe(false);
    await act(async () => { pdf.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(postedFormats).toEqual(['pdf']);
    expect(heldViolations()).toEqual([]);
  });

  it('leaves the certified path unchanged: a 500 keeps the original retry words', async () => {
    mockCaps = { settled: true, eligible: true, authority: authority(true) };
    nextPost = () => respond(500, { error: 'boom' });
    await mount();
    await act(async () => { downloadButtons()[0].click(); await Promise.resolve(); await Promise.resolve(); });
    expect(text()).toContain(RETRY_COPY);
    expect(text()).not.toContain(HELD_COPY);
  });
});

describe('lethality — each defeat candidate fails the checks on its named violation', () => {
  it('downloads still offered while the capability read says held', async () => {
    await mount((s) => s
      .replace('{bookFilesHeld ? (', '{false ? (')
      .replace(" || !bookFileOpen('pdf')", '')
      .replace(" || !bookFileOpen('epub')", ''));
    expect(heldViolations()).toContain('download-offered-while-held');
  });

  it('generic retry copy on a 423', async () => {
    mockCaps = { settled: true, eligible: true, authority: authority(true) };
    await mount((s) => s.replace('isBookExportHeldRefusal(res.status, refusal)', 'false'));
    await act(async () => { downloadButtons()[0].click(); await Promise.resolve(); await Promise.resolve(); });
    expect(heldViolations()).toContain('retry-copy-shown-for-a-refusal-a-retry-cannot-lift');
  });
});

describe('Home — the door to Sources does not say "Bring" while bringing is held', () => {
  const home = fs.readFileSync(HOME_VIEW, 'utf8');
  const doors = home.match(/onClick=\{props\.onSources\}>[^<]*</g) ?? [];

  it('both Home doors read "Notes & sources", the label the returning writer already sees', () => {
    expect(doors).toHaveLength(2);
    for (const door of doors) expect(door).toBe('onClick={props.onSources}>Notes &amp; sources<');
  });

  it('lethality — the old "Bring notes & sources" label is caught by the same check', () => {
    const regressed = home.replace('>Notes &amp; sources<', '>Bring notes &amp; sources<');
    expect(regressed).not.toBe(home);
    const regressedDoors = regressed.match(/onClick=\{props\.onSources\}>[^<]*</g) ?? [];
    expect(regressedDoors.every((d) => d === 'onClick={props.onSources}>Notes &amp; sources<')).toBe(false);
  });
});
