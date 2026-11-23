# Deploy 2026-11-23: review plan revision 3 for the exact one pending migration (Pro Astrology kept conversations)

**Date:** 2026-11-23
**Status:** BOUNDED INDEPENDENT REVIEW PLAN, revision 3. NO DEPLOYMENT AUTHORITY BY ITSELF.

**Live old reader:** supplied by the harness through `MIGRATION_COMPATIBILITY_CONTEXT.json`. The reviewer establishes it
from the bundle, and the deploy lane re-witnesses it before mutation.

**Founder authorization (Kelly, in session; owner chain #1982 → #1893):**
- 2026-11-22: Pro Ask-MAIA conversations are kept; Keep on by default with a per-conversation switch; resumable;
  client-chart conversations per client only (spec `docs/programme/ASTRO-PRO-KEEP-CONVERSATIONS_SPEC_2026-11-22.md`).
- 2026-11-23: **"Yes, prepare deploy"**, in reply to *"Merge and deploy PR #2374 so conversations save?"*, after a
  Pro tester lost a second conversation on the live site. The container swap remains a separately confirmed act.

## Why revision 3

Revision 2 (`ASTRO-PRO-KEEP_MIGRATION_REVIEW_PLAN_R2_2026-11-23.md`, sha256
`7b74bf86d6c01a9223dc04a6e0b1a417db1d7bcd4035372efd3e76bd3373d3e6`, target `56ab7d683`) was reviewed afresh
(session `1671f696-c80e-4754-84ba-767480e3ab98`, 15 Read events). Verdict **REVISE**, COMPATIBLE,
ALL_PREFIXES_COMPATIBLE; findings medium 2 · low 4. REVISE is recorded as-is and not reused. The two medium findings
were **fixed in code** in this target (PR adding this plan), not argued away:

- **R2-F1 (medium) — a kept thread became unreachable after "New conversation".** Fixed. "New conversation" is now
  **"Start over"**: with Keep on it asks the member to confirm and deletes the kept thread before clearing the panel.
  There is one kept conversation per subject, and it is always the one the panel resumes and can remove.
- **R2-F2 (medium) — ruling 4 says a client conversation is deleted with the client record.** Fixed.
  `deleteSavedChart` (`lib/astrology/proSavedCharts.ts`) now deletes, in the same SQL statement, every
  `astro_pro_threads` row of the owner whose subject key names the deleted chart as subject or other.
- **R2-F3 (low) — Keep switched off during the first in-flight answer.** Fixed: the switch and Start over are
  disabled while an answer is in flight.
- **R2-F4 (low) — Keep off left the thread row.** Fixed: `setKeep(false)` deletes the whole thread; turns go by
  cascade. Nothing of a conversation the member stopped keeping remains.
- **R2-F5 (low) — after an image rollback, an open tab running the target panel sends fields the old ask route
  rejects (400).** Accepted: a reload recovers; the old reader stores nothing either way.
- **R2-F6 (low) — the `.rollback` file is destructive and manual.** Accepted as in revision 2 (F4).

Revision 1's dispositions F2–F5 stand. F1 (Keep off not sticky across visits) stands as ruled: per conversation.

## Why revision 2

Revision 1 (`ASTRO-PRO-KEEP_MIGRATION_REVIEW_PLAN_2026-11-23.md`, sha256
`e4debf0313b564308dc0320a4f023fdf116aa9e6e88dc05f33a4ce3da5ab74d1`, target `a702bb0d1`) was reviewed by an independent
read-only `claude -p` process (session `748aed0b-5a54-4d58-845b-8f2d9fc0109e`, 12 Read events). Verdict APPROVED,
COMPATIBLE, ALL_PREFIXES_COMPATIBLE, with findings medium 2 · low 3. Admission was **refused**
(`MATERIAL_UNDER_APPROVED`): an approval may not stand past its own medium findings. Under the review law the
revision-1 review is not reused. The findings are dispositioned below, and this revision is reviewed afresh.

### Dispositions

- **F1 (medium) — "Keep off is not sticky server-side."** Accepted as designed, under founder ruling 2 (Keep is ON by
  default, **per conversation**). Facts for the reviewer to confirm in the target:
  - `setKeep(false)` deletes the thread's turns and sets `keep = false`; `ownsKeptThread` and `findLatestThread`
    require `keep = true`, so a switched-off thread is never resumed or written again;
  - the panel (`app/astrology/pro-preview/ProAskMaiaPanel.tsx`) keeps the switch in panel state and sends `keep`
    with every ask, and sends `threadId` only when `keep` is true; with Keep off the route stores nothing;
  - a later visit is a new conversation and starts with Keep on, which is the ruling, not a defect.
  A server-side "remember my off preference" is out of scope for this deploy and needs its own ruling.
- **F2 (medium) — "Registering `astro_pro_threads` refuses, rather than erases."** Accepted; the plan wording was
  wrong. `app/api/members/delete-account/route.ts` runs `CONTAINMENT_POSTURE = 'refuse'`, under which **every**
  MAIA conversation table (`conversation_turns`, `maia_sessions`, …) already refuses self-service deletion and
  directs the member to support. Pro threads join that existing category. The posture is a founder/legal decision
  the route names and this deploy does not change. The spec's erasure wording is corrected in this target.
- **F3 (low)** — app-only rollback to `4afa2d10d` would leave members with kept threads unable to delete their
  account (FK RESTRICT, generic refusal) until a forward fix. Accepted as the known cost of image rollback.
- **F4 (low)** — the `.rollback` file is destructive and manual only. Accepted: break-glass, needs its own
  authorization and an export first. The supported rollback is image-only.
- **F5 (low)** — default-on retention of client-chart conversations. Confirmed intended: founder ruling 4
  (2026-11-22, "Yes, per client only").

## Exact target relation

The target is the canonical merge commit of the PR that adds this plan. Its first parent is `56ab7d683` (the merge of
PR #2377, docs only, on top of `a702bb0d1`, the merge of PR #2374). It differs from that parent by this plan and the
code fixes listed under "Why revision 3" (no migration). The old
reader `4afa2d10d24634f2b93ed77cf20c5f19b1d40aaa` is the first parent of `a702bb0d1`, so this pending set is exactly
the one migration PR #2374 adds.
The reviewer establishes the relation from immutable git bytes where it can, and otherwise says so.

## Exact production-pending set

1. `database/migrations/20261122000001_astro_pro_conversations.sql`
   sha256 `6c9843bcb6d4125f6e01e4944c69308b9b485829ede2fde5caf75a6d7c340a65`

It has a sibling `20261122000001_astro_pro_conversations_rollback.rollback` (sha256
`b941dbae00d4b39146ab6e517b187ab6c28dbee03919fa4a778fe6eb35e68886`) and carries its own `BEGIN … COMMIT` with
`SET LOCAL lock_timeout = '5s'` first.

## What the migration does

- **`astro_pro_threads`:** new table. `member_id` FK `members(id)` **ON DELETE RESTRICT**; `subject_key` non-empty;
  `keep` default true; index `(member_id, subject_key, last_turn_at DESC)`.
- **`astro_pro_turns`:** new table. FK `astro_pro_threads(id)` ON DELETE CASCADE; PK `(thread_id, turn_index)`;
  `speaker` ∈ {member, maia}; non-empty `body`.
- **`astro_pro_turns_append_only()`** plus a BEFORE UPDATE trigger refusing any UPDATE of a turn. DELETE is allowed.

It changes no existing table and no existing data.

## Production facts supplied to the reviewer

Read-only, 2026-11-23, under `BEGIN READ ONLY`. Counts and schema only.
- **Live:** `4afa2d10d` (DEPLOY_LANE `deploy-lane`, created 2026-11-22T13:07:38Z).
- **Database:** PostgreSQL 16.13. Newest applied migration `20261116000002_living_work_studio_stage_and_notes.sql`;
  no canonical migration is pending before this one.
- **The objects:** `astro_pro_threads`, `astro_pro_turns` and the function `astro_pro_turns_append_only` do not exist.
  `gen_random_uuid()` is available.
- **Row counts:** `members` 97.

## Independent review questions

1. **Additive.** Confirm the migration only creates new objects and changes no existing table or data.
2. **Locking.** The only lock on an existing table is the FK reference to `members` (SHARE ROW EXCLUSIVE while
   adding the constraint on an empty new table). Is `lock_timeout = '5s'` a safe failure mode?
3. **Old reader compatibility.** The exact old reader `4afa2d10d` has no code that names either new table. Establish
   whether any old-reader statement could be affected, in particular member account deletion
   (`app/api/members/delete-account/route.ts`) during the migrate-before-swap window, when both tables are empty.
4. **Target readers and writers.** In the target, confirm:
   - `lib/astrology/proConversationStore.ts` scopes every read and write by `member_id`, and a thread id from the
     client is accepted only if it belongs to the caller and subject (`ownsKeptThread`);
   - `app/api/astrology/pro/ask/route.ts` stores turns only when `keep` is true and a subject key is given, stores
     no crisis/safety turn, and a storage failure does not fail the answer;
   - `app/api/astrology/pro/conversation/route.ts` (GET resume, PATCH keep) is owner-scoped, and Keep off deletes
     that thread's turns;
   - target account deletion registers `astro_pro_threads` as governed content, so under the `refuse` posture a member
     with kept threads is refused cleanly (support path) rather than failing on the FK; turns go with their thread by
     cascade. Confirm every revision-3 fix above against the code, including that saved-chart deletion removes
     only the owner's threads naming that chart.
5. **Prefix compatibility.** The single prefix 1 is compatible with the exact old reader still being live.
6. **Rollback.** The supported rollback is app-only: image rollback to `4afa2d10d`, schema staying. Judge it, in
   particular whether the old reader's account deletion would be refused by the RESTRICT FK for a member who has
   kept threads, and name what is blocked or lost. Then judge the destructive `.rollback` file.
7. **Member-visible change and consent.** From the target code, what does a member newly have stored, is it
   written only by the member's own act of asking with Keep on, and can the member stop and remove it?

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- This plan, and `MIGRATION_COMPATIBILITY_CONTEXT.json`.
- The migration and its rollback file.
- `scripts/deploy-production.sh` and `scripts/run-sql-migrations.sh`.
- Target files:
  - `lib/astrology/proConversationStore.ts`
  - `app/api/astrology/pro/ask/route.ts`
  - `app/api/astrology/pro/conversation/route.ts`
  - `app/api/members/delete-account/route.ts`
  - `app/astrology/pro-preview/ProAskMaiaPanel.tsx`
  - `lib/astrology/proSavedCharts.ts`
  - `app/api/astrology/pro/charts/[id]/route.ts`
  - `docs/programme/ASTRO-PRO-KEEP-CONVERSATIONS_SPEC_2026-11-22.md`
- Exact old-reader files:
  - `app/api/members/delete-account/route.ts`
  - `app/api/astrology/pro/ask/route.ts`

## Required review JSON

Use the ordinary Review-Custody fields, plus `migration_compatibility` with:
- `instrument = migration-compatibility/v1`;
- the exact commits;
- `pending` = the one path with its SHA-256;
- the `old_reader_evidence` actually read;
- `failure_prefix_compatibility` with exactly **one** prefix entry bound to that path and SHA-256.

## Closing condition

An admitted `APPROVED` review with `COMPATIBLE` and `ALL_PREFIXES_COMPATIBLE` licenses the migrate-before-swap
sequence for this exact pending set only. It is not a statement that the migration or the feature is correct.
