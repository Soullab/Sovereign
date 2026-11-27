/**
 * Founder direction 2026-11-27: Pro Astrology is reachable from Home for members
 * admitted to it, and the free room is named Basic Astrology. Source contract;
 * the Home place list is unchanged (adding a place needs a preferences migration).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeById } from '@/lib/house/catalog';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Pro Astrology door on Home', () => {
  it('names the free room Basic Astrology', () => {
    expect(placeById('astrology')?.label).toBe('Basic Astrology');
  });

  it('decides Pro admission on the server with the Pro room\'s own check, failing closed', () => {
    const house = read('app/house/page.tsx');
    expect(house).toMatch(/await proRoomsForMember\(member\.id\)/);
    expect(house).toMatch(/proAstrologyAdmitted = proRooms\.some\(\(room\) => room\.id === 'pro-astrology'\)/);
    expect(read('lib/house/proRooms.ts')).toMatch(/proAstrology: \(memberId\) => proMemberAllowed\(memberId, process\.env\)/);
    expect(house).toMatch(/proAstrology=\{proAstrologyAdmitted\}/);
  });

  it('shows the Pro door on the House sky card only when admitted', () => {
    const field = read('components/astrology/CurrentTransitsField.tsx');
    expect(field).toMatch(/variant === 'house' && proAstrology \? \(\s*<Link href="\/astrology\/pro-preview">Open Astrology Studio →<\/Link>/);
  });

  it('sends Pro members from the one-line sky row (phones, iPads, narrow windows) to Pro Astrology', () => {
    const house = read('app/house/page.tsx');
    expect(house).toMatch(/<CurrentTransitsField variant="line" proAstrology=\{proAstrologyAdmitted\} \/>/);
    const field = read('components/astrology/CurrentTransitsField.tsx');
    expect(field).toMatch(/if \(proAstrology\) \{\s*return <Link href="\/astrology\/pro-preview"/);
  });
});
