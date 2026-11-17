/**
 * The words, and the one flag, for Writer's Studio doors that are held.
 *
 * A door that always refuses is not presented as open. Two of the held doors are named here so the server's refusal
 * and what the member is shown cannot drift into different sentences. This module imports nothing, so a client page
 * and a server route can both read it.
 *
 * ── Source intake ────────────────────────────────────────────────────────────────────────────────────────────────
 * POST /api/writers-studio/sources is a hard hold in code (sourcesPostHold.test.ts) and stays one even though the
 * release manifest says member intake is RELEASED: there is no encrypted handler behind the refusal. So the page cannot
 * learn the hold from the manifest capability (`sourceIntakeReleased` is true). It reads SOURCE_UPLOADS_HELD, and
 * sourceUploadHeldCoupling.test.ts fails if the route holds while this flag says otherwise.
 * Lifting the hold is a deliberate change to the route, to sourcesPostHold.test.ts and to this flag, together.
 *
 * ── Page files (PDF / EPUB) ──────────────────────────────────────────────────────────────────────────────────────
 * The render route answers 423 with code MEMBER_BOOK_EXPORT_HELD while member book export is not released
 * (lib/manuscript/render/memberBookExportRelease.ts). Whether to OFFER a file is read from the server-owned release
 * capability (`exportsCertified`, via useWriterReleaseCapabilities), the same read the Publish room uses; a 423 that
 * arrives anyway is read as "held", never as a failure to retry.
 */

export const SOURCE_UPLOADS_HELD = true;

/** The route's refusal text, verbatim. Also what the Sources page shows as the reason. */
export const SOURCE_UPLOAD_HELD_MESSAGE =
  'Source uploads are temporarily unavailable pending independent security and recovery acceptance.';

/** The plain-words lead the Sources page puts before the reason. */
export const SOURCE_UPLOAD_HELD_LEAD = "Adding new files isn't open yet.";

/** Must equal the `code` in app/api/sovereign/manuscripts/[id]/render/route.ts (pinned by closedDoorProof.test.ts). */
export const MEMBER_BOOK_EXPORT_HELD_CODE = 'MEMBER_BOOK_EXPORT_HELD';

/** Shown in the Review room's Proof tab in place of "Make proof" while page files are held. */
export const PAGE_PROOF_HELD_COPY = "Page proofs aren't available yet. Your writing is unchanged.";

/** Shown on the legacy "Your Book" tab in place of the PDF / EPUB downloads while they are held. */
export const BOOK_FILES_HELD_COPY = "PDF and EPUB copies of your book aren't available yet. Your writing is unchanged.";

/**
 * Is this refusal "held", as opposed to a failure a retry might lift? The render route sends 423 in exactly two places,
 * both holds: member book export not released (code MEMBER_BOOK_EXPORT_HELD) and a format not certified. So a bare
 * 423 and the route's own code are read the same way.
 */
export function isBookExportHeldRefusal(status: number, body: unknown): boolean {
  if (status === 423) return true;
  return typeof body === 'object' && body !== null && (body as { code?: unknown }).code === MEMBER_BOOK_EXPORT_HELD_CODE;
}
