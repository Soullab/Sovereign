# Deploy 2026-11-23: review plan for the exact one pending migration (Pro Astrology kept conversations)

**Date:** 2026-11-23
**Status:** BOUNDED INDEPENDENT REVIEW PLAN. NO DEPLOYMENT AUTHORITY BY ITSELF.

**Live old reader:** supplied by the harness through `MIGRATION_COMPATIBILITY_CONTEXT.json`. The reviewer establishes it
from the bundle, and the deploy lane re-witnesses it before mutation.

**Founder authorization (Kelly, in session; owner chain #1982 → #1893):**
- 2026-11-22: Pro Ask-MAIA conversations are kept; Keep on by default with a per-conversation switch; resumable;
  client-chart conversations per client only (spec `docs/programme/ASTRO-PRO-KEEP-CONVERSATIONS_SPEC_2026-11-22.md`).
- 2026-11-23: **"Yes, prepare deploy"**, in reply to *"Merge and deploy PR #2374 so conversations save?"*, after a
  Pro tester lost a second conversation on the live site. The container swap remains a separately confirmed act.

## Exact target relation

The target is the canonical merge commit of PR #2374, which carries this plan. Its first parent is the live old reader
`4afa2d10d24634f2b93ed77cf20c5f19b1d40aaa` (canonical tip at review time). The PR adds exactly one migration (below).
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
   - target account deletion registers `astro_pro_threads` so a member with kept threads can still be erased, and
     turns go with their thread by cascade.
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
