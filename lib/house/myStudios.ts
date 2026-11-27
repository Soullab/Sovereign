/**
 * My Studios on Home (founder ruling 2026-11-27, recorded on #1875).
 *
 * Pure arrangement of what Home already knows, for the client and for tests:
 *  - held Pro rooms come first, admitted only by their own grant (lib/house/proRooms.ts);
 *  - then the member's chosen places (saved House preferences, `center`, at most five)
 *    that are Studios (lib/house/catalog.ts `placeKind`);
 *  - the member's chosen Living Spaces are returned separately, in their saved order, so
 *    Home shows them in their own row. A member's choices are never rewritten or dropped.
 * A chosen Pro Studio the member also holds shows once, as the held Pro room.
 */
import { placeKind, type HousePlace } from './catalog';
import type { ProRoomDoor } from './proRooms';

export interface StudioCard {
  key: string;
  label: string;
  purpose: string;
  href: string;
  mark: string;
  tone?: HousePlace['tone'];
  placeId?: string;
  pro: boolean;
}

export function arrangeMyStudios(chosen: readonly HousePlace[], proRooms: readonly ProRoomDoor[]): {
  studios: StudioCard[];
  livingSpaces: HousePlace[];
} {
  const heldIds = new Set<string>(proRooms.map((room) => room.id));
  const studios: StudioCard[] = proRooms.map((room) => ({
    key: room.id, label: room.label, purpose: room.purpose, href: room.href, mark: room.mark, pro: true,
  }));
  const livingSpaces: HousePlace[] = [];
  for (const place of chosen) {
    if (placeKind(place.id) === 'studio') {
      if (heldIds.has(place.id)) continue;
      studios.push({ key: place.id, label: place.label, purpose: place.purpose, href: place.href, mark: place.mark, tone: place.tone, placeId: place.id, pro: false });
    } else {
      livingSpaces.push(place);
    }
  }
  return { studios, livingSpaces };
}
