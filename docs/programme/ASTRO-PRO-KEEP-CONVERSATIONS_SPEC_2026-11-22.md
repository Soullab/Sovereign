# ASTRO-PRO-KEEP — Pro Astrology conversations are kept (2026-11-22)

Owner chain: SOULLAB-CONTINUITY-01 #1982 → ASTRO-PRO-04 #1893. Related holds: R4F #1817, release #1938.
Standing: **Designed** (this spec). Phase 1 source on branch `astro-pro/keep-conversations`. Not deployed;
deployment is a separate founder act and does not lift the #1893 production hold.

## Trigger (member witness)

A Pro tester had a long, meaningful Ask-MAIA conversation about her own chart in the evening and found it
gone the next morning. She expected to continue where she left off, with the same memory MAIA has elsewhere.

Cause (code read, canonical `4afa2d10d`): the thread lived only in browser memory
(`ProAskMaiaPanel.tsx` → `usePanelState` → `panelMemory.tsx`). The route
`app/api/astrology/pro/ask/route.ts` stores nothing ("Nothing is stored or logged but the fact of an
answer"). A reload, closed tab or browser discard erased it. Not recoverable server-side.
This was the designed behaviour (R6 "Pro chats stay visit-bound",
`ASTRO-PRO-MAIA-GUIDE-01_SPEC_2026-11-11.md:57`), not a fault — the failure is the mismatch with what
members reasonably expect.

## Founder rulings (Kelly, 2026-11-22, in session)

1. **Pro conversations are kept.** This supersedes R6 "visit-bound" and the panel copy "nothing from this
   conversation is saved".
2. **Keep is ON by default**, with a per-conversation "Keep this conversation" switch the member can turn
   off. (Chosen over off-by-default and ask-at-start.)
3. **Purpose:** members build on these conversations for themselves and for clients, and expect MAIA to
   remember, pattern-match and expand on them across sessions.

Open for founder confirmation (asked once, with recommendation):

- **Client charts.** Recommended: a conversation about a client's chart is kept in *that client's* record
  only. MAIA builds on it across sessions about that client; it never enters the astrologer's personal MAIA
  memory or another client's record, and it is deleted with the client record. Phase 1 already scopes every
  thread to its subject, so this ruling governs only Phase 2 recall.

## Design

### Phase 1 — keep, resume, switch (this branch)

- **Storage:** new tables `astro_pro_threads` (one per conversation: `member_id`, `subject_key`, `keep`,
  `opened_at`, `last_turn_at`) and `astro_pro_turns` (`thread_id`, `turn_index`, `speaker`, `body`,
  `created_at`), modelled on Writer's `ask_threads`/`ask_turns`: append-only turns, member-deletable thread,
  `member_id … ON DELETE RESTRICT`.
- **Not** `conversation_turns`: `TurnsStore.getRecentTurns` recalls every row for a member into main MAIA,
  which would silently move chart conversations into the main conversation (the R4F concern). Recall into
  MAIA's wider memory is Phase 2, deliberate and consented.
- **Scope:** a thread is keyed by the panel's existing subject key (`ask.<section>.<subject>.<other>`), so a
  client's thread is never mixed with the astrologer's own.
- **Keep switch:** default on. Turning it off for a thread deletes that thread's stored turns and stops
  further writes. A thread with Keep off behaves exactly as today.
- **Resume:** opening the same subject loads the member's most recent kept thread for it, so the panel shows
  the earlier turns and MAIA's `history` continues from them.
- **Safety turns** (fixed crisis reply, MAIA not asked) are not stored, matching current `history` rules.
- **Erasure:** both tables registered in `app/api/members/delete-account/route.ts`; covered by
  `blockingForeignKeys.test.ts`.
- **Copy:** "nothing from this conversation is saved" is replaced by an honest statement of the Keep state.

### Phase 2 — memory (after Phase 1 is witnessed; not built here)

- Own-chart threads with Keep on become available to MAIA's memory under the existing consent and
  return rules (memory atoms), so MAIA can recognise patterns across Pro and main conversations.
  This lifts R4F #1817 for the member's **own** chart only, under this ruling.
- Client threads: per-client recall only, per the client ruling above.

## Growth-obligation answers (CLAUDE.md)

- **Uncertainty introduced:** stored interpretations may later be read as settled. Turns are stored verbatim
  with timestamps, never summarised into claims in Phase 1.
- **Provenance and ownership:** threads belong to the member; turns are append-only; the member can delete a
  thread or stop keeping it at any time; erasure covers both tables.
- **New responsibility:** member conversation content is now held for Pro. It must be covered by backup,
  erasure and Sanctuary rules. Sanctuary: Pro has no Sanctuary mode today; Keep off is the equivalent and
  must store nothing.

## Acceptance

- Unit: route stores a turn pair only when Keep is on; Keep off deletes and stores nothing; resume returns
  only the caller's own thread for that subject.
- Erasure test passes with the new tables registered.
- **Device witness (F6-style):** talk, close the tab, return next day on the same and a different device,
  thread present and MAIA continues it. Not complete until witnessed.
