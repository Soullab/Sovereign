/**
 * The Sources page and the Sources route say the same thing about the hold, from ONE constant.
 *
 * sourcesPostHold.test.ts pins that POST refuses (423, uncached, before the body is read) and is deliberately NOT
 * tied to the release manifest, which says intake is released. So the page cannot learn the hold from the manifest
 * capability; it learns it from the shared module below, and this file pins the two together:
 *  - while the route answers 423, the page's flag must say held;
 *  - the route's refusal text IS the shared text (no second literal that can drift from what the page shows).
 *
 * Lifting the hold is a deliberate change to the route, to sourcesPostHold.test.ts and to the shared flag together.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { loadFromSource } from '@/app/writers-studio/__tests__/support/loadFromSource';
import { SOURCE_UPLOADS_HELD, SOURCE_UPLOAD_HELD_MESSAGE } from '@/lib/writersStudio/heldDoorCopy';

jest.mock('@/lib/auth/getMemberFromRequest', () => ({
  getMemberIdFromRequest: jest.fn(async () => '11111111-1111-4111-8111-111111111111'),
}));
jest.mock('@/lib/db/postgres', () => ({ query: jest.fn(async () => ({ rows: [] })) }));

const ROUTE = path.join(process.cwd(), 'app/api/writers-studio/sources/route.ts');
const FLAGS = path.join(process.cwd(), 'lib/writersStudio/heldDoorCopy.ts');
const post = (mod: Record<string, any>) => mod.POST as (r?: NextRequest) => Promise<Response>;

async function refusalOf(mod: Record<string, any>) {
  const res = await post(mod)();
  return { status: res.status, error: ((await res.json()) as { error?: string }).error };
}

/** Named violations of the coupling law; empty is conforming. */
async function couplingViolations(route: Record<string, any>, flag: boolean, message: string): Promise<string[]> {
  const found: string[] = [];
  const { status, error } = await refusalOf(route);
  if (status === 423 && !flag) found.push('route-holds-but-the-page-flag-says-open');
  if (error !== message) found.push('route-words-differ-from-the-words-the-page-shows');
  return found;
}

describe('sources route and page agree on the hold', () => {
  it('the route and the shared constants are in agreement', async () => {
    expect(await couplingViolations(loadFromSource(ROUTE), SOURCE_UPLOADS_HELD, SOURCE_UPLOAD_HELD_MESSAGE)).toEqual([]);
  });

  it('the shared text is the refusal sourcesPostHold.test.ts pins, word for word', () => {
    expect(SOURCE_UPLOAD_HELD_MESSAGE).toBe(
      'Source uploads are temporarily unavailable pending independent security and recovery acceptance.',
    );
  });

  it('the route carries no second copy of the refusal text', () => {
    const src = fs.readFileSync(ROUTE, 'utf8');
    expect(src).toContain('SOURCE_UPLOAD_HELD_MESSAGE');
    expect(src).not.toContain('Source uploads are temporarily unavailable');
  });
});

describe('lethality — each defeat candidate fails the same check on its named violation', () => {
  it('a page flag that says open while the route still answers 423', async () => {
    const flags = loadFromSource(FLAGS, (s) => s.replace('SOURCE_UPLOADS_HELD = true', 'SOURCE_UPLOADS_HELD = false'));
    expect(await couplingViolations(loadFromSource(ROUTE), flags.SOURCE_UPLOADS_HELD, SOURCE_UPLOAD_HELD_MESSAGE))
      .toContain('route-holds-but-the-page-flag-says-open');
  });

  it('a route with its own literal in different words', async () => {
    const drifted = loadFromSource(ROUTE, (s) =>
      s.replace('{ error: SOURCE_UPLOAD_HELD_MESSAGE }', "{ error: 'Uploads are closed.' }"));
    expect(await couplingViolations(drifted, SOURCE_UPLOADS_HELD, SOURCE_UPLOAD_HELD_MESSAGE))
      .toContain('route-words-differ-from-the-words-the-page-shows');
  });
});
