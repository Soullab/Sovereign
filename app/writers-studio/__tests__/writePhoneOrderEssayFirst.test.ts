/**
 * Case study F1 (live walk 2026-11-16, production 85cb169ff, ~686px wide): on a phone the Write room put MAIA's column ABOVE the
 * writer's page. The ≤720px Write rules ordered the page (1) and the place list (2) but left MAIA at the default order 0.
 * The page must come first, MAIA after it, the place list last. Desktop and tablet composition are untouched.
 */
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(process.cwd(), 'app/dev/writers-studio-full-redesign-review/full-redesign-review.css'), 'utf8');

function phoneWriteBlock(): string {
  // The Write room's own ≤720px block (the one that recomposes .fr-room into a column for data-mode='write').
  const marker = ".fr-shell[data-mode='write'] .fr-room { display: flex; flex-direction: column;";
  const at = css.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const open = css.lastIndexOf('@media (max-width: 720px) {', at);
  const close = css.indexOf('\n}', at);
  return css.slice(open, close);
}
const orderOf = (block: string, selector: string): number | null => {
  const m = block.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*order:\\s*(\\d+)'));
  return m ? Number(m[1]) : null;
};

test('on a phone the writer’s page is first, MAIA second, the place list last', () => {
  const block = phoneWriteBlock();
  const work = orderOf(block, ".fr-shell[data-mode='write'] .fr-work");
  const maia = orderOf(block, ".fr-shell[data-mode='write'] .fr-maia");
  const rail = orderOf(block, ".fr-shell[data-mode='write'] .fr-manuscript");
  expect(work).toBe(1);
  expect(maia).toBe(2);
  expect(rail).toBe(3);
  // MAIA must never be left without an explicit order in this block: the default (0) puts her above the page.
  expect(maia).not.toBeNull();
});

test('the fix lives only in the phone block: no new order rule for .fr-maia outside it', () => {
  const block = phoneWriteBlock();
  const elsewhere = css.replace(block, '');
  expect(elsewhere).not.toMatch(/\.fr-shell\[data-mode='write'\] \.fr-maia\s*\{[^}]*order:/);
});
