import { readFileSync } from 'fs';
import { join } from 'path';
import { writerSectionLabel } from '../writerSectionLabel';

describe('WS-F2 · the writer sees one name for one section', () => {
  it('⭐ MUST FAIL IF an unheaded section is named anything but "Section N" (the manuscript list\'s name)', () => {
    expect(writerSectionLabel({ heading: null, position: 0 })).toBe('Section 1');
    expect(writerSectionLabel({ heading: '   ', position: 2 })).toBe('Section 3');
  });
  it('a heading is used as written (trimmed)', () => {
    expect(writerSectionLabel({ heading: '  The Harbour ', position: 0 })).toBe('The Harbour');
  });
  it('an unknown section gives no name, so the caller keeps what it had', () => {
    expect(writerSectionLabel(undefined)).toBeNull();
  });
});

describe('WS-F2 · the route names "what MAIA read" for the writer, and leaves MAIA\'s labels alone (static)', () => {
  const route = readFileSync(join(__dirname, '..', '..', '..', '..', 'app/api/sovereign/manuscripts/[id]/ask/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  it('⭐ MUST FAIL IF the writer-facing read list stops using the shared writer name', () => {
    expect(route).toMatch(/const read = supplied\.map\(\(x\) => \(\{\s*sectionId: x\.id,\s*label: writerSectionLabel\(/);
  });
  it('⛔ the sections handed to MAIA keep their own label (Deep-Intelligence gate: naming for the writer never changes the mind)', () => {
    expect(route).toContain('sections: supplied.map((x) => ({ id: x.id, label: x.label, body: x.body');
  });
});
