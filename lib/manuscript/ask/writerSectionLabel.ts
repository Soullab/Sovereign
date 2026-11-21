/**
 * WS-F2 (live walk 2026-11-21, production 2fa63e846): the "what MAIA read" line said "an untitled section" while the manuscript list
 * and the page called the same section "Section 1". The writer saw two names for one place.
 *
 * PURE: the name the WRITER sees for a section, by the same rule the Studio's manuscript list uses
 * (`heading?.trim() || Section {position + 1}`, e.g. P4R1DevelopController, DevelopStage, liveWriteAdapter).
 * ⛔ Writer-facing only. The labels MAIA is given are unchanged ("(no heading)" in askReader); this names, it does not think.
 */
export function writerSectionLabel(section: { heading: string | null; position: number } | undefined | null): string | null {
  if (!section) return null;
  return section.heading?.trim() || `Section ${section.position + 1}`;
}
