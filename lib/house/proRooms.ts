/**
 * Founder direction 2026-11-27: a member who holds a Pro room of their own
 * (paid or granted) finds its door on Home automatically.
 *
 * Each room is admitted ONLY by that room's own grant check, the same one the
 * room itself enforces. Doors are derived on every Home load and never written
 * into saved House preferences, so a revoked or expired grant removes the door
 * by itself. A failed or unreadable check admits no one (fail closed).
 *
 * To add a Pro room: add one entry to PRO_ROOMS with its own admission check.
 */
import { proMemberAllowed } from '@/lib/astrology/proAccess';
import { readProStudioGrant } from '@/lib/proStudio/grant';

export interface ProRoomDoor {
  id: 'pro-astrology' | 'pro-studio';
  label: string;
  purpose: string;
  href: string;
}

export interface ProRoomChecks {
  proAstrology: (memberId: string) => Promise<boolean>;
  proStudio: (memberId: string) => Promise<boolean>;
}

export const PRO_ROOMS: ReadonlyArray<ProRoomDoor & { check: keyof ProRoomChecks }> = [
  { id: 'pro-astrology', label: 'Pro Astrology', purpose: 'Your full chart, transits and readings', href: '/astrology/pro-preview', check: 'proAstrology' },
  { id: 'pro-studio', label: 'Pro Studio', purpose: 'Your practice workspace', href: '/pro-studio', check: 'proStudio' },
];

export const defaultProRoomChecks: ProRoomChecks = {
  proAstrology: (memberId) => proMemberAllowed(memberId, process.env),
  proStudio: async (memberId) => (await readProStudioGrant(memberId)).entitlement === 'verified',
};

async function admitted(check: () => Promise<boolean>): Promise<boolean> {
  try {
    return (await check()) === true;
  } catch {
    return false;
  }
}

/** The Pro rooms this member holds, in catalog order. `memberId` must come from the server session. */
export async function proRoomsForMember(
  memberId: string,
  checks: ProRoomChecks = defaultProRoomChecks,
): Promise<ProRoomDoor[]> {
  const results = await Promise.all(PRO_ROOMS.map((room) => admitted(() => checks[room.check](memberId))));
  return PRO_ROOMS.filter((_, i) => results[i]).map(({ id, label, purpose, href }) => ({ id, label, purpose, href }));
}
