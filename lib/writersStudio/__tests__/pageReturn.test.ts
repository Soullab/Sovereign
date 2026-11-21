/**
 * Conversation-stage design, build step 5 (founder decision 2026-11-04; lane authorized 2026-11-17): one gesture, "Back to the page",
 * returns to the same passage and the same scroll position. Pure helper tests plus pins on the view's wiring; the browser walk is the
 * acceptance (jsdom keeps an element's scrollTop, so it cannot reproduce a lost position).
 */
import fs from 'node:fs';
import path from 'node:path';
import { capturePagePlace, restorePagePlace } from '@/lib/writersStudio/pageReturn';

const scroller = (scrollTop: number, top = 0, bottom = 600) => ({ scrollTop, getBoundingClientRect: () => ({ top, bottom }) });
const passage = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ top, bottom }), scrollIntoView: jest.fn() });

describe('Back to the page: the same passage, the same place', () => {
  it('⭐ MUST FAIL IF the page comes back at the top: the scroll position is restored exactly', () => {
    const place = capturePagePlace(scroller(1240), 's7')!;
    const s = scroller(0);
    expect(restorePagePlace(s, place, 's7', passage(200, 260))).toBe('restored');
    expect(s.scrollTop).toBe(1240);
  });
  it('⭐ MUST FAIL IF an old position is forced on a passage the writer moved to in the room: that passage is shown instead', () => {
    const place = capturePagePlace(scroller(1240), 's7')!;
    const s = scroller(0);
    const p = passage(900, 960);
    expect(restorePagePlace(s, place, 's9', p)).toBe('revealed');
    expect(s.scrollTop).toBe(0);
    expect(p.scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
  });
  it('the passage is brought into view when the restored position no longer shows it (the page reflowed)', () => {
    const place = capturePagePlace(scroller(400), 's7')!;
    const p = passage(700, 760); // below the scroller's visible bottom (600)
    expect(restorePagePlace(scroller(0), place, 's7', p)).toBe('revealed');
    expect(p.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });
  it('nothing captured, no page: nothing moves, nothing throws', () => {
    expect(capturePagePlace(null, 's1')).toBeNull();
    expect(restorePagePlace(null, null, 's1', null)).toBe('none');
    const p = passage(100, 120);
    expect(restorePagePlace(scroller(0), null, 's1', p)).toBe('revealed');
  });
});

describe('the view wires it to the room opening and closing', () => {
  const view = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx'), 'utf8');
  it('⭐ the page place is recorded while the page is in view, and restored when the room closes', () => {
    expect(view).toMatch(/capturePagePlace\(/);
    expect(view).toMatch(/restorePagePlace\(/);
    expect(view).toMatch(/\.fr-write-scroll/);
  });
});
