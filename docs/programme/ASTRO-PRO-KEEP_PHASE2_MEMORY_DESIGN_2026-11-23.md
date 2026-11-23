# ASTRO-PRO-KEEP Phase 2 — kept Pro conversations in MAIA's memory (design, 2026-11-23)

Owner chain: #1982 → ASTRO-PRO-04 #1893. Addendum to `ASTRO-PRO-KEEP-CONVERSATIONS_SPEC_2026-11-22.md`.
Holds touched: R4F #1817. Base: `clean-main-no-secrets` at `1c70c3c6f` (Phase 1 merged).
Standing: **AUTHORIZED to build** — founder ruling Kelly, 2026-11-23, in session: "Approve as designed"
(§6 (a)–(c) as written). This authorizes building and a PR only; it does not authorize merging, migrating
or deploying anything.

## 1. What already governs this (read, with exact wording)

| Instrument | Exact text, as read | What it means here |
|---|---|---|
| Kelly, 2026-11-22, ruling 3 | Members "expect MAIA to remember, pattern-match and expand on them across sessions." Confirmed again on 2026-11-23: "We definitely need this." | Phase 2 is wanted. |
| Kelly, 2026-11-22, ruling 4 | "Yes, per client only." A client's conversation is kept in that client's record only, never in the astrologer's personal memory or another client's record. | Client recall stays in Pro and is scoped to one chart. |
| Spec, Phase 2 bullet | "This lifts R4F #1817 for the member's **own** chart only, under this ruling." | This is the spec author's sentence, not a quote from Kelly. It rests on ruling 3. |
| R4H founder policy, 2026-10-13 (#1817), principles 1 and 2 | "Private charts remain private until deliberate member-selected transfer to MAIA." "A one-time Send does not authorize future unrelated MAIA recall." | Still approved. Lifting the R4F hold allows transfer but does not remove these principles. Transfer has to be a deliberate act by the member. |
| Memory canon: `member_memory_atoms` | "Keeping is the consent act." `crossing_must_be_false`: "material in one layer cannot be crossed with material in another to form higher-order claims without explicit member ratification." | The existing path is the member's Keep act, and it forbids MAIA's own cross-material conclusions. |
| Atom prompt (`memoryAtomsLoader.ts`) | "Recognize naturally if the present moment connects, but do NOT cross-reference, synthesize, or interpret across them." | MAIA may recognise one thing that connects to now. She may not draw a conclusion across several. |
| P6 (`20260903000001`) | Column default is `member_pulled`. Return authority "must be constructed" at the write site from the member's own act. | Phase 2 writes must set `return_preference` explicitly. |

**Tension, put to Kelly in §6.** "Pattern-match" in ruling 3 cannot mean that MAIA draws conclusions
across kept material. That would need a schema migration of `crossing_must_be_false` and a change of canon.
The canon-compatible reading is the one recommended below: MAIA notices a possible connection and offers it
as a question. The member confirms it or lets it go.

## 2. How main MAIA conversations become memory (what is reused)

There are three paths. Only the third is consent-governed:

1. `conversation_turns` → `TurnsStore.getRecentTurns`: every turn is recalled automatically. Phase 1
   rejected this for Pro (the R4F concern), and Phase 2 does too.
2. Automatic derivatives (developmental, theme and vector signals). These are inferred, not member-placed.
   Not used.
3. **Keep → `member_memory_atoms`**, through `keepSource()` in `lib/psyche/portfolio.ts`, the "single
   governed minting capability". The member sees and manages atoms on `/maia/keep-capture` (reseal, set
   aside, archive). They are read under return consent by `loadMemberMemoryAtomsForPrompt`, in main MAIA
   (`/api/oracle/conversation`), Between, room composition, and **Pro Ask with `personal` on**. **Phase 2
   reuses this path.**

Because Pro's `personal` mode already reads atoms, one carried passage serves both directions. Main MAIA
sees it, and Pro sees it the next time the member asks about their own chart with `personal` on.

## 3. Own chart: carry into MAIA's memory (requires the ruling in §6)

- **The act:** on an own-chart thread with one chart only (subject key `ask.<section>.own.`, no second
  chart), each kept exchange gets a "Keep with MAIA" control. Pressing it is the deliberate,
  member-selected transfer that R4H principle 1 requires. Each press is its own act, so one carry never
  authorizes another (principle 2). Nothing is carried automatically, and Keep being on does not mean
  carry.
- **What is written:** one atom per exchange, through `keepSource()` (it is not copied):
  - `source_type = 'astro_pro_exchange'` (new; the CHECK needs a migration). The name states where the
    material came from, so it cannot be confused with a main-MAIA `session_excerpt`.
  - `source_id` = the MAIA turn's new `astro_pro_turns.id` (new uuid column, additive). The existing
    unique index `(member_id, source_type, source_id)` makes a second press idempotent.
  - `title` = the member's question, verbatim. `body` = MAIA's answer, verbatim, capped at 1,200
    characters with an ellipsis. Never a summary.
  - `provenance` (existing jsonb) = `{surface:'astro_pro', section, thread_id, turn_index,
    asked_at}`. No birth data, no name, no chart id.
  - `epistemological_status = 'inferred'` for MAIA's answer (it is her reading). The member's question is
    their own words.
  - `return_preference = 'contextual_doorway'`, set explicitly at the write site from the member's act,
    as P6 requires. `memory_scope = 'personal'`.
- **Prompt rendering:** `projectAtomSections` gains one branch for `astro_pro_exchange`. It renders: You
  asked "…" in Pro Astrology (section, relative date); MAIA's reading then was: "…" — *an interpretation
  offered at the time, not a finding about the member*. The canon discipline text is unchanged.
- **Removal:** the member already has reseal, set aside and archive on `/maia/keep-capture`. "Start over"
  and Keep-off delete the Pro thread. A carried atom is the member's separate Keep act and stays until the
  member removes it, as with any other Keep. The Start-over confirm text says so and names the place to
  remove it. Account erasure already covers both tables.
- **Not carried:** client charts, two-chart threads (biwheel or composite, even own + client), safety
  replies, Sanctuary-equivalent (Keep off) threads. The server refuses each case (it is not just hidden
  in the UI): the carry route re-derives the subject from the stored thread and refuses unless it is
  `own` with no other chart.

## 4. Clients: per-client recall inside Pro (no new consent question)

- When the astrologer asks about saved chart X, MAIA also receives earlier kept exchanges from the
  astrologer's **other** single-chart threads about X (other sections). They are verbatim and dated, at
  most 6 exchanges and 6,000 characters, newest first. This is what "later sessions about that same client"
  needs, because Phase 1 resume is already per section.
- Query: `member_id = caller AND split_part(subject_key,'.',3) = X AND split_part(subject_key,'.',4) = ''
  AND keep`. Two-chart threads are excluded, so client Y never enters client X's context.
- **Nothing is written to `member_memory_atoms`** for a client. `personal` stays refused for saved charts
  (existing route rule). The astrologer's personal memory never sees a client, by construction, not by
  convention.
- Deletion: `deleteSavedChart` already deletes every thread naming X (Phase 1, merged). Recall reads only
  those threads, so nothing derived survives the chart. The "owed in Phase 2" cascade line in the spec is
  already done.
- The same recall runs for the member's own chart inside Pro. It is Pro-internal and does not cross into
  main MAIA.
- Prompt framing for recalled exchanges: "Earlier conversations about this chart (verbatim, dated). They
  were readings at the time, not settled facts. You may point out a possible connection as a question; do
  not state conclusions about the person."

## 5. Growth-obligation answers

- **Uncertainty introduced:** an earlier reading can come back looking like an established fact. MAIA could
  also reinforce her own earlier interpretation. **How it is preserved:** content is verbatim only and
  never summarised. Every item is dated and labelled with who said it. MAIA's turns carry
  `epistemological_status='inferred'` and the "interpretation at the time" framing. Connections are offered
  as questions and never stored unless the member keeps them. `crossing_must_be_false` stays.
- **Provenance and ownership:** the atom names its surface, section, thread and turn. The member owns it,
  sees it on `/maia/keep-capture`, and reseals or archives it. Client material has no atom at all; it lives
  only in that chart's threads and is deleted with the chart.
- **New responsibility:** chart-derived interpretation now reaches main MAIA, which is the thing R4F held.
  This creates three responsibilities: (a) the carry route must be the only write path and must refuse
  anything other than own-chart material; (b) tests that a client exchange can never become an atom or
  appear in another chart's recall; (c) the device witness must include the main-MAIA side (carry →
  main MAIA recognises it → archive → it no longer surfaces).

## 6. Founder ruling (one question)

**Approve Phase 2 as designed?** That is:
(a) own-chart passages reach MAIA's wider memory only when the member presses "Keep with MAIA" on an
exchange;
(b) "pattern-match" means MAIA may notice a possible connection and offer it as a question, never
a conclusion, so the no-crossing canon stands;
(c) clients are recalled only inside Pro, per chart, and never become memory atoms.

**Recommendation: approve.** (a) is what R4H principle 1 already requires, and it is how every other MAIA
memory is formed. (b) keeps the canon intact. The alternative is "every kept own-chart conversation
carries automatically", which would set aside an approved R4H principle and the Keep doctrine. That is
Kelly's call, but it is not recommended.

## 7. Build plan (after approval) — built 2026-11-23 on `feature/astro-pro-keep-phase2`

As built: the migration is `20261123000001_astro_pro_keep_phase2.sql`; the carry route is `POST /api/astrology/pro/conversation/carry`; `appendExchange` returns MAIA's turn index; the Ask route skips recall when Keep is off and in mentor mode. Not yet done: device witness and independent migration review.


1. Migration `2026112300000x_astro_pro_keep_phase2.sql` with its rollback:
   `astro_pro_turns.id uuid DEFAULT gen_random_uuid()`, backfilled, unique. Extend the
   `member_memory_atoms_source_type_check` CHECK with `astro_pro_exchange`, using the refuse-on-unexpected
   guard from the capsule migration. It is additive and needs independent migration review custody per
   `scripts/deploy-production.sh` and the R3 plan precedent.
2. `lib/astrology/proConversationStore.ts`: `listTurns` returns turn ids. Add
   `recallSubjectExchanges(memberId, chartSubject, excludeThreadId)`.
3. `POST /api/astrology/pro/conversation/carry {threadId, turnIndex}`: verify owner, kept thread,
   own-chart single subject and a MAIA turn, then call `keepSource` with an explicit return authority.
   `keepSource` gains an optional `returnPreference` and `provenance`/`epistemologicalStatus`, set only
   by this caller.
4. `ask/route.ts`: inject the per-subject recall block. `memoryAtomsLoader.ts`: add the
   `astro_pro_exchange` rendering.
5. `ProAskMaiaPanel.tsx`: the "Keep with MAIA" control on own-chart exchanges (the state is shown once
   pressed) and the Start-over copy.
6. Tests: carry refused for client, two-chart, another member's thread, a member turn, Keep off; idempotent
   double press; recall never returns another chart's or a two-chart thread; deleting a chart empties its
   recall; the atom renders with the interpretation framing; `return_preference` is explicit.
   Erasure test unchanged.
7. Acceptance: device witness, own chart (carry → main MAIA → archive) and client (natal then transits on
   the same client; a second client sees nothing).

## 8. Found, not fixed (reported only)

- **Update 2026-11-23:** the P6 write-site fix (#1741) merged to main as `5f585217d`. This branch now uses its member-conferred return authority for the carried atom and adds only provenance and epistemic standing. #1741 is merged but not deployed.
- *(Superseded, kept for the record)* **P6 write-site fix is not on main.** `20260903000001` sets the default to `member_pulled`, but
  `lib/psyche/returnAuthority.ts` and the explicit `contextual_doorway` at `keepSource` (commits
  `d44473826`, `09f934f96`, `6c6228c24`) are **not ancestors of `clean-main-no-secrets`**. The `keepSource`
  INSERT omits `return_preference`. Wherever that migration is applied, new member keeps would land sealed
  and never return. This is a code read; production state was not inspected. Owner: the memory/P6 lane.
- Already recorded on the log: the delete-account `GOVERNED_CONTENT` row counts `maia_sessions.user_id`,
  but the column is `member_id`.
