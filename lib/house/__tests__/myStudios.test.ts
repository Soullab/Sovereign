/**
 * My Studios (founder ruling 2026-11-27, recorded on #1875): held Pro rooms first,
 * then chosen Studios; chosen Living Spaces kept in their own row, never dropped.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeById, placeKind, DEFAULT_CENTER_IDS, HOUSE_PLACES, type HousePlace } from '@/lib/house/catalog';
import { arrangeMyStudios } from '@/lib/house/myStudios';
import type { ProRoomDoor } from '@/lib/house/proRooms';

const places = (...ids: string[]) => ids.map((id) => placeById(id) as HousePlace);
const ASTRO: ProRoomDoor = { id: 'pro-astrology', label: 'Astrology Studio', purpose: 'p', href: '/astrology/pro-preview', mark: '◉' };
const PRO_STUDIO: ProRoomDoor = { id: 'pro-studio', label: 'Pro Studio', purpose: 'p', href: '/pro-studio', mark: '◈' };

describe('studio / living-space classification', () => {
  it('follows the founder ruling', () => {
    for (const id of ['writing', 'pro-studio', 'studio', 'divination', 'ideas']) expect(placeKind(id)).toBe('studio');
    for (const id of ['relationships', 'reflections', 'journal', 'dream', 'astrology', 'practices', 'community',
      'changes', 'decisions', 'wisdom', 'library', 'anchor', 'living-field', 'co-lab']) expect(placeKind(id)).toBe('space');
  });

  it('names the studios as ruled and keeps ids and routes', () => {
    expect(placeById('writing')?.label).toBe("Writer's Studio");
    expect(placeById('writing')?.href).toBe('/writers-studio?from=house');
    expect(placeById('divination')?.label).toBe('Divination Studio');
    expect(placeById('divination')?.href).toBe('/oracle');
    expect(placeById('astrology')?.label).toBe('Basic Astrology');
    expect(HOUSE_PLACES).toHaveLength(19);
  });
});

describe('arrangeMyStudios', () => {
  it('keeps a default member\'s chosen Living Spaces instead of displacing them', () => {
    const { studios, livingSpaces } = arrangeMyStudios(places(...DEFAULT_CENTER_IDS), []);
    expect(studios.map((s) => s.key)).toEqual(['writing', 'studio']);
    expect(livingSpaces.map((p) => p.id)).toEqual(['relationships', 'practices', 'community']);
  });

  it('puts held Pro rooms first, then chosen studios in saved order', () => {
    const { studios } = arrangeMyStudios(places('ideas', 'writing'), [ASTRO]);
    expect(studios.map((s) => [s.key, s.pro])).toEqual([['pro-astrology', true], ['ideas', false], ['writing', false]]);
  });

  it('shows a chosen Pro Studio once, as the held room', () => {
    const { studios } = arrangeMyStudios(places('pro-studio', 'writing'), [PRO_STUDIO]);
    expect(studios.map((s) => [s.key, s.pro])).toEqual([['pro-studio', true], ['writing', false]]);
  });

  it('shows an unheld Pro Studio choice as the ordinary place', () => {
    const { studios } = arrangeMyStudios(places('pro-studio'), []);
    expect(studios.map((s) => [s.key, s.pro])).toEqual([['pro-studio', false]]);
  });

  it('allows five chosen places plus held Pro rooms', () => {
    const { studios } = arrangeMyStudios(places('writing', 'studio', 'divination', 'ideas', 'pro-studio'), [ASTRO, PRO_STUDIO]);
    expect(studios).toHaveLength(6);
  });
});

describe('Home wiring', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
  it('renders My Studios, Living Spaces and Explore Soullab', () => {
    const prefs = read('app/house/HousePreferences.tsx');
    expect(prefs).toMatch(/aria-label="My Studios"/);
    expect(prefs).toMatch(/LIVING SPACES/);
    expect(prefs).toMatch(/EXPLORE SOULLAB/);
    expect(prefs).toMatch(/Show all \{studios\.length\} studios/);
    expect(read('app/house/page.tsx')).toMatch(/<strong>Explore Soullab<\/strong>/);
  });
  it('names the Pro astrology room Astrology Studio', () => {
    expect(read('lib/house/proRooms.ts')).toMatch(/label: 'Astrology Studio'/);
    expect(read('components/astrology/CurrentTransitsField.tsx')).toMatch(/Open Astrology Studio →/);
  });
});
