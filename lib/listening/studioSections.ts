/**
 * Sections of Sound Studio that the player bar can open from anywhere (#1979, 2026-11-19).
 *
 * The listen room keeps its view in state, so an address such as /listen#focus-sound used to land on Now.
 * The bar's links now (1) scroll in place when the section is already on screen, (2) otherwise announce the
 * section with STUDIO_SECTION_EVENT so an open listen room switches view, and (3) still carry the address,
 * which a listen room reads when it first opens. Navigation stays inside the app, so the one player keeps
 * playing.
 */
import type { StudioView } from '@/app/listen/SoundStudioNow';

export const STUDIO_SECTION_EVENT = 'soullab:studio-section';
export type StudioSection = 'focus-field' | 'focus-sound';

/** The view that holds a section, or null for an address that is not a known section. */
export function viewForSection(hashOrId: string | null | undefined): StudioView | null {
  const id = (hashOrId ?? '').replace(/^#/, '');
  return id === 'focus-field' || id === 'focus-sound' ? 'focus' : null;
}

/**
 * Brings a section to the member visibly: scrolls to it, marks it for a moment (data-attention), and moves
 * keyboard focus to its chosen option. Scrolling alone did nothing visible when the section was already on
 * screen (founder, 2026-11-19: "nothing happens").
 */
export function revealStudioSection(element: HTMLElement): void {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.setAttribute('data-attention', 'true');
  window.setTimeout(() => element.removeAttribute('data-attention'), 1800);
  const target = element.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"], button, a, input');
  target?.focus({ preventScroll: true });
}

/** Click handler for a bar link to a section. Returns true when it handled the move in place. */
export function openStudioSection(section: StudioSection, event: { preventDefault: () => void }): boolean {
  if (typeof document === 'undefined') return false;
  const here = document.getElementById(section);
  if (here) {
    event.preventDefault();
    revealStudioSection(here);
    return true;
  }
  window.dispatchEvent(new CustomEvent(STUDIO_SECTION_EVENT, { detail: section }));
  return false;
}
