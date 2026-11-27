import type { DoorwayId } from '@/lib/studios/doorways';
import { pathFromParam } from '@/lib/writersStudio/studioPaths';

/**
 * A Studio doorway may preserve only a known, member-selected local sub-path.
 * Writer paths are exact allowlisted ids; every unknown/cross-Studio value falls
 * back to the Studio's ordinary local destination.
 */
export function doorwayReturnPath(
  studio: DoorwayId,
  studioPath: string,
  selectedPath: string | null | undefined,
): string {
  if (studio !== 'writer') return studioPath;
  const path = pathFromParam(selectedPath);
  return path ? `${studioPath}?path=${encodeURIComponent(path.id)}` : studioPath;
}

/** WS-WELCOME-01: the page a writer who has just joined at Writer's Studio's door is sent to first. */
export const WRITER_WELCOME_PATH = '/writers-studio/welcome';

/**
 * Where a person goes the first time, straight after creating their account at a Studio's door
 * (founder 2026-11-21: "Yes, wire it in" — new writers land on the welcome invitation).
 *
 * - Writer's Studio, no path chosen → the welcome invitation.
 * - Writer's Studio, an allowlisted path chosen (e.g. College Essay) → that path's own guided start,
 *   unchanged: the writer already chose where to begin.
 * - Any other Studio → its ordinary destination.
 *
 * Only for first arrival. Returning members signing in keep `doorwayReturnPath`.
 */
export function doorwayFirstArrivalPath(
  studio: DoorwayId,
  studioPath: string,
  selectedPath: string | null | undefined,
): string {
  if (studio !== 'writer') return studioPath;
  return pathFromParam(selectedPath) ? doorwayReturnPath(studio, studioPath, selectedPath) : WRITER_WELCOME_PATH;
}
