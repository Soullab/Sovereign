/**
 * Beta evidence 2026-11 (tester on a MacBook Air, browser window under 1024px): the centre showed "TALKING WITH MAIA · <title>" while the
 * conversation was crammed into the right panel. Cause (CSS read at cc9db2111): the write-mode override for <=1023px sets the room to
 * `rail | centre | 0` and re-places the rail and the page, but never re-places `.fr-maia`, so the generic tablet rule
 * (`.fr-maia { grid-column: 2 }`) drops MAIA's column into the same track as the page, painted over it.
 * Source-level pins on the CSS (jest has no layout engine); the browser walk at ~1000px is the acceptance.
 */
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-full-redesign-review/full-redesign-review.css'), 'utf8');

/** Every @media block whose query contains `max-width: 1023px` but not a phone-only range; returns the block bodies. */
function laptopBlocks(src: string): string[] {
  const out: string[] = [];
  const re = /@media([^{]*)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (!/max-width:\s*1023px/.test(m[1]!)) continue;
    let depth = 1; let i = re.lastIndex;
    while (depth > 0 && i < src.length) { if (src[i] === '{') depth += 1; else if (src[i] === '}') depth -= 1; i += 1; }
    out.push(src.slice(re.lastIndex, i - 1));
  }
  return out;
}
/** The declarations of the LAST rule (in source order) whose selector list is exactly `selector`. */
function lastRule(blocks: string[], selector: string): string | null {
  let found: string | null = null;
  for (const b of blocks) {
    const re = /([^{}]+)\{([^{}]*)\}/g; let m: RegExpExecArray | null;
    while ((m = re.exec(b))) if (m[1]!.trim() === selector) found = m[2]!;
  }
  return found;
}
const col = (decl: string | null) => decl?.match(/grid-column:\s*([^;]+);/)?.[1]?.trim() ?? null;
const blocks = laptopBlocks(css);

describe('Write at laptop widths (721–1023px): MAIA has a column of her own, and the conversation takes the stage', () => {
  it('⭐ MUST FAIL IF MAIA\'s column shares the page\'s track in write mode', () => {
    const work = col(lastRule(blocks, ".fr-shell[data-mode='write'] .fr-work"));
    const maia = col(lastRule(blocks, ".fr-shell[data-mode='write'] .fr-maia"));
    expect(work).not.toBeNull();
    expect(maia).not.toBeNull();
    expect(maia).not.toBe(work);
  });

  it('⭐ MUST FAIL IF write mode gives MAIA a zero-width track while her column is shown', () => {
    const room = lastRule(blocks, ".fr-shell[data-mode='write'] .fr-room") ?? '';
    const template = room.match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? '';
    expect(template).not.toMatch(/\s0\s*$/);
    expect(template.split(/\s+(?![^(]*\))/).length).toBe(2);
  });

  it('⭐ MUST FAIL IF, with the conversation open in the centre, the guide column still squeezes it (the stage is the whole width)', () => {
    const sel = ".fr-shell[data-mode='write']:has([data-write-centre-conversation='true'])";
    const room = lastRule(blocks, `${sel} .fr-room`) ?? '';
    expect(room).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(lastRule(blocks, `${sel} .fr-maia`) ?? '').toMatch(/display:\s*none/);
    expect(lastRule(blocks, `${sel} .fr-manuscript`) ?? '').toMatch(/display:\s*none/);
    expect(col(lastRule(blocks, `${sel} .fr-work`))).toBe('1');
  });

  it('the laptop composition does not reach the phone: those rules sit in a block that starts at 721px', () => {
    const src = css.slice(css.indexOf("@media (min-width: 721px) and (max-width: 1023px)"));
    expect(css).toContain('@media (min-width: 721px) and (max-width: 1023px)');
    expect(src).toContain(":has([data-write-centre-conversation='true'])");
  });

  it('the centre conversation still carries the marker these rules depend on', () => {
    const view = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-pc3-live/P4R1Pc3WriteEditView.tsx'), 'utf8');
    expect(view).toMatch(/data-write-centre-conversation="true"/);
  });
});
