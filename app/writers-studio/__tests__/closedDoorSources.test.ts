/**
 * Closed doors, honest — Sources.
 *
 * POST /api/writers-studio/sources refuses EVERY upload with 423 (pinned by sourcesPostHold.test.ts, which this
 * change leaves untouched). The page used to offer an active "Choose files or photographed pages" control anyway and
 * revealed the refusal only after a file had been picked, aborting a whole multi-file batch on the first refusal.
 *
 * Law under test: a door that always refuses is not presented as open. The chooser is disabled, the reason is on the
 * page before any file is picked, and what the writer has already brought in stays reviewable.
 *
 * Mounts the REAL page in jsdom; hooks, router and network are fictional doubles. Not an authenticated server witness.
 * Defeat candidates are the real file with one plausible wrong change; each must fail the same checks.
 *
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import path from 'node:path';
import { loadFromSource } from './support/loadFromSource';

const mockApiFetch = jest.fn();
let mockSources: unknown[] = [];
let mockWorks: unknown[] = [];

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: (p: { href: string; className?: string; children?: React.ReactNode }) =>
    React.createElement('a', { href: p.href, className: p.className }, p.children),
}));
jest.mock('@/lib/http/apiBase', () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
jest.mock('@/app/writers-studio/useStudioSources', () => ({
  useStudioSources: () => ({ phase: 'ready', sources: mockSources, reload: async () => undefined }),
}));
jest.mock('@/app/writers-studio/useLivingWorks', () => ({
  useLivingWorks: () => ({ phase: 'ready', works: mockWorks, reload: async () => undefined }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const PAGE = path.join(process.cwd(), 'app/writers-studio/sources/page.tsx');
/** The route's refusal text, as pinned by sourcesPostHold.test.ts. Written out here on purpose. */
const ROUTE_MESSAGE = 'Source uploads are temporarily unavailable pending independent security and recovery acceptance.';

const reviewedSource = {
  id: 'src-1', originalName: 'fictional-notebook.txt', mimeType: 'text/plain', sizeBytes: 12,
  sourceKind: 'typed_text', transcriptionStatus: 'reviewed', createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

let host: HTMLDivElement;
let root: Root;

function mount(mutate?: (src: string) => string) {
  const Page = loadFromSource(PAGE, mutate).default as React.ComponentType;
  act(() => root.render(React.createElement(Page)));
}

/** Named violations of the law; an empty list is a conforming page. */
function violations(): string[] {
  const found: string[] = [];
  const chooser = Array.from(host.querySelectorAll('button'))
    .find((b) => /Choose files or photographed pages/.test(b.textContent ?? ''));
  if (chooser && !chooser.disabled) found.push('chooser-offered-while-route-refuses');
  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  if (input && !input.disabled) found.push('file-input-live-while-route-refuses');
  const reason = host.querySelector('[data-source-upload-held]');
  if (!reason) found.push('reason-not-on-page');
  else if (!(reason.textContent ?? '').includes(ROUTE_MESSAGE)) found.push('reason-differs-from-route-refusal');
  return found;
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockSources = [];
  mockWorks = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('Sources page — a held door is not offered as open', () => {
  it('disables the chooser and names the reason before any file is picked', () => {
    mount();
    expect(violations()).toEqual([]);
  });

  it('makes no upload request just by being opened', () => {
    mount();
    expect(mockApiFetch.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'POST')).toEqual([]);
  });

  it('keeps what the writer already brought in reviewable and deletable', () => {
    mockSources = [reviewedSource];
    mockWorks = [{ id: 'work-1', title: 'A fictional Work', materials: [] }];
    mount();
    expect(host.textContent).toContain('fictional-notebook.txt');
    expect(host.textContent).toContain('Bring this to the Work');
    expect(host.textContent).toContain('Delete source');
    expect(violations()).toEqual([]);
  });

  it('keeps the strings sourceIntake.test.ts pins for the review path', () => {
    mount();
    expect(host.textContent).toContain('When automatic reading is available');
  });
});

describe('lethality — each defeat candidate fails the checks on its named violation', () => {
  it('chooser still enabled while the route says 423', () => {
    mount((s) => s.replace('disabled={uploading || SOURCE_UPLOADS_HELD}', 'disabled={uploading}'));
    expect(violations()).toContain('chooser-offered-while-route-refuses');
  });

  it('file input still live behind the visible button', () => {
    mount((s) => s.replace(' disabled={SOURCE_UPLOADS_HELD}', ''));
    expect(violations()).toContain('file-input-live-while-route-refuses');
  });

  it('no reason on the page (the refusal still waits until after a file is picked)', () => {
    mount((s) => s.replace('{SOURCE_UPLOAD_HELD_MESSAGE}', "{''}"));
    expect(violations()).toContain('reason-differs-from-route-refusal');
  });

  it('a reason in different words from the route refusal', () => {
    mount((s) => s.replace('{SOURCE_UPLOAD_HELD_MESSAGE}', 'Uploads are paused for now.'));
    expect(violations()).toContain('reason-differs-from-route-refusal');
  });
});
