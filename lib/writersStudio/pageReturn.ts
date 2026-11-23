/**
 * Conversation-stage design, build step 5 (founder decision 2026-11-04; lane authorized 2026-11-17): "Back to the page" returns the
 * writer to the same passage and the same scroll position, explicitly, rather than by whatever the page happens to keep.
 * Pure: it reads and sets scroll offsets on the elements it is given. No text in, no text out.
 */
export interface PagePlace { focusId: string | null; scrollTop: number }
interface Box { top: number; bottom: number }
export interface PageScroller { scrollTop: number; getBoundingClientRect(): Box }
export interface PagePassage { getBoundingClientRect(): Box; scrollIntoView(opts: { block: 'nearest' | 'center'; inline: 'nearest' }): void }

export function capturePagePlace(scroller: PageScroller | null, focusId: string | null): PagePlace | null {
  return scroller ? { focusId, scrollTop: scroller.scrollTop } : null;
}

/**
 * Same passage: the exact scroll position comes back, and the passage is brought into view only if the page has reflowed so that it is
 * no longer visible. Another passage (the writer moved in the room): that passage is shown; an old position is never forced on it.
 */
export function restorePagePlace(scroller: PageScroller | null, place: PagePlace | null, focusId: string | null, passage: PagePassage | null): 'restored' | 'revealed' | 'none' {
  if (scroller && place && place.focusId === focusId) {
    scroller.scrollTop = place.scrollTop;
    if (!passage) return 'restored';
    const view = scroller.getBoundingClientRect();
    const at = passage.getBoundingClientRect();
    if (at.bottom > view.top && at.top < view.bottom) return 'restored';
    passage.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return 'revealed';
  }
  if (!passage) return 'none';
  passage.scrollIntoView({ block: 'center', inline: 'nearest' });
  return 'revealed';
}
