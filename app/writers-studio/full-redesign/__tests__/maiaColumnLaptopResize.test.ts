/**
 * Founder 2026-11-24, walking the Write room in a 918px window: "the column needs to be movable! Too tight on right side".
 * At laptop widths (721–1023px) MAIA keeps a column beside the page, but her divider was hidden and the column capped at 340px.
 * Walked in the browser pane: the divider shows on MAIA's edge, a mouse drag widens her column, the page keeps ≥340px,
 * the width survives a reload, and a double-click returns the 340px default. These pins hold the CSS and Shell seams.
 */
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-full-redesign-review/full-redesign-review.css'), 'utf8');
const shell = fs.readFileSync(path.join(process.cwd(), 'app/writers-studio/full-redesign/Shell.tsx'), 'utf8');
const band = (() => {
  const marker = "@media (min-width: 721px) and (max-width: 1023px) {\n  .fr-shell[data-right-open='true'] .fr-panel-splitter-right";
  const at = css.indexOf(marker);
  return at < 0 ? '' : css.slice(at, css.indexOf('\n}', at));
})();

describe('MAIA\'s divider at laptop widths', () => {
  test('shows MAIA\'s divider, on the edge of the column she actually takes', () => {
    expect(band).toContain('display: block');
    expect(band).toContain('var(--fr-maia-col, var(--fr-maia-w))');
  });

  test('negative: the manuscript divider stays hidden there (the chapter list is a band above the page)', () => {
    expect(band).not.toContain('fr-panel-splitter-left');
    expect(css).toMatch(/@media \(max-width: 1023px\) \{\s*\.fr-panel-controls, \.fr-panel-splitter \{ display: none; \}/);
  });

  test('the 340px default stays until the writer sets a width; a set width is kept', () => {
    expect(css).toContain(".fr-shell[data-mode='write'] { --fr-maia-col: min(var(--fr-maia-w), 340px); }");
    expect(css).toContain(".fr-shell[data-mode='write'][data-maia-width-chosen='true'] { --fr-maia-col: var(--fr-maia-w); }");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) var(--fr-maia-col);");
    expect(css).not.toContain('min(var(--fr-maia-w), 340px); grid-template-rows');
  });

  test('Shell marks a chosen width, clears it on reset, and starts a drag from the width shown', () => {
    expect(shell).toContain("data-maia-width-chosen={rightChosen ? 'true' : 'false'}");
    expect(shell).toContain("else { setRightWidth(width); setRightChosen(true); }");
    expect(shell.match(/setRightChosen\(false\)/g)?.length).toBe(2);
    expect(shell).toContain("startWidth: side === 'left' ? leftWidth : shownRightWidth()");
    // In the band the chapter list takes no width from MAIA's column; the page still keeps CENTRE_MIN.
    expect(shell).toContain('const leftBeside = leftVisible && !besideBand;');
    expect(shell).toContain('bounds - space - other - CENTRE_MIN');
  });
});
