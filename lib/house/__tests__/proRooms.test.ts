/**
 * Founder direction 2026-11-27: Pro rooms a member holds appear on Home
 * automatically, each admitted only by its own grant, failing closed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { proRoomsForMember, type ProRoomChecks } from '@/lib/house/proRooms';

const MEMBER = '00000000-0000-4000-8000-000000000001';
const checks = (astro: boolean | Error, studio: boolean | Error): ProRoomChecks => ({
  proAstrology: async () => { if (astro instanceof Error) throw astro; return astro; },
  proStudio: async () => { if (studio instanceof Error) throw studio; return studio; },
});

describe('proRoomsForMember', () => {
  it('shows no Pro rooms to a member who holds none', async () => {
    expect(await proRoomsForMember(MEMBER, checks(false, false))).toEqual([]);
  });

  it('shows each room the member holds, in catalog order', async () => {
    const rooms = await proRoomsForMember(MEMBER, checks(true, true));
    expect(rooms.map((r) => [r.id, r.href])).toEqual([
      ['pro-astrology', '/astrology/pro-preview'],
      ['pro-studio', '/pro-studio'],
    ]);
  });

  it('admits each room only by its own check', async () => {
    expect((await proRoomsForMember(MEMBER, checks(false, true))).map((r) => r.id)).toEqual(['pro-studio']);
    expect((await proRoomsForMember(MEMBER, checks(true, false))).map((r) => r.id)).toEqual(['pro-astrology']);
  });

  it('fails closed: a check that throws admits no one, and the others still answer', async () => {
    expect((await proRoomsForMember(MEMBER, checks(new Error('db down'), true))).map((r) => r.id)).toEqual(['pro-studio']);
    expect(await proRoomsForMember(MEMBER, checks(new Error('x'), new Error('y')))).toEqual([]);
  });

  it('Pro Studio admits only a verified grant; doors are never saved into House preferences', () => {
    const src = readFileSync(join(process.cwd(), 'lib/house/proRooms.ts'), 'utf8');
    expect(src).toMatch(/readProStudioGrant\(memberId\)\)\.entitlement === 'verified'/);
    expect(src).not.toMatch(/housePreferences|writeHousePreferences|INSERT|UPDATE/);
  });

  it('Home renders the section only when the member holds a room', () => {
    const page = readFileSync(join(process.cwd(), 'app/house/page.tsx'), 'utf8');
    expect(page).toMatch(/proRooms\.length > 0 \? \(\s*<section className=\{styles\.proRooms\}/);
    expect(page).toMatch(/cabinOffline \? \[\] : await proRoomsForMember\(member\.id\)/);
  });
});
