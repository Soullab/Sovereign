# Deploy 2026-11-15: review plan for the exact one pending migration (Studio program per Work)

**Date:** 2026-11-15
**Status:** BOUNDED INDEPENDENT REVIEW PLAN. NO DEPLOYMENT AUTHORITY BY ITSELF.

**Live old reader:** supplied by the harness through `MIGRATION_COMPATIBILITY_CONTEXT.json`. The reviewer establishes it
from the bundle, and the deploy lane re-witnesses it before mutation.

**Founder authorization (Kelly, 2026-11-15, in session; ledger #1938):**
- "lets deploy", given in direct reply to the question of whether the #2298 merge stands and whether to deploy it.
  The deploy of the merged #2298 (College Essay program-aware Studio) is authorized. The deploy target is main.

Also in the target, beyond #2298: #2297 (record the last sign-in time on every sign-in path; code only, writes the
existing `members.last_sign_in` column and never throws) and #2292 (one line in `docs/PRIORITY_THREAD_LOG.md`).

## Exact target relation

The target is the canonical merge commit of the PR that adds this plan. It must differ from its own first parent only
by this documentation file, and that first parent must add no migration beyond the one below. The reviewer
establishes the relation from immutable git bytes where it can, and otherwise says so.

## Exact production-pending set

1. `database/migrations/20261115000001_living_work_studio_path.sql`
   sha256 `9bf37e0370e994ab338f68128272490ad98e42dcbcec036e1fe06a83d36654c7`

Its sibling `20261115000001_living_work_studio_path_rollback.rollback` has sha256
`388151660d1fc4da0ec0141d559a797e9a4f7ad912c9293fc28a87f57e6390fa`. The migration carries its own `BEGIN … COMMIT`,
with `SET LOCAL lock_timeout = '5s'` first.

## What the migration does

- It creates `studio_programs` (`id` text primary key with a format CHECK, `created_at`) and seeds `'college-essay'`.
- It adds a nullable column `living_works.studio_path` with no default and no backfill.
- It adds the FK `living_works_studio_path_program_fk` → `studio_programs(id)`.
- It adds the trigger `living_works_studio_path_fixed`, `BEFORE UPDATE OF studio_path`. The trigger refuses clearing
  or changing a non-null program.

It changes no existing data.

## Production facts supplied to the reviewer

Read-only, 2026-11-15, under `BEGIN READ ONLY`. Counts and schema only, no member content.
- **Live:** `82a3543ae575d816a57fe4fe08a31007d9093c0c`, an ancestor of main.
- **Database:** PostgreSQL 16.13. The newest applied migration is `20261113000010_…`. `20261115000001` is not recorded.
  `git diff 82a3543ae..main -- database/migrations` adds only the two files above.
- **The objects:** `studio_programs` does not exist, and `living_works.studio_path` does not exist.
- **Row counts:** `living_works` has 30 rows and `members` has 97.

Throwaway-cluster proof: `scripts/qa/prove-studio-path-migration.sh` passed 8/8 on PostgreSQL 14.19 and on 16.15
(2026-11-15). The proof includes an app-only rollback that is lossless under the old reader's writes, and the refusal
of the destructive rollback while a program is carried.

## Independent review questions

1. **Additive.** Confirm the migration only creates new objects plus one nullable column, an FK on that column and a
   column-scoped trigger. Confirm it rewrites and changes no existing data.
2. **Locking.** On a 30-row `living_works`, judge the lock taken by `ADD COLUMN` (nullable, no default) and by
   `ADD CONSTRAINT … FOREIGN KEY` (validated, all values NULL). Is `lock_timeout = '5s'` a safe failure mode?
3. **Old reader compatibility.** Establish from the exact old reader whether any of its statements on `living_works`
   could be affected by the new column, FK or trigger: inserts, updates, deletes, and `SELECT *` consumers. Particular
   cases:
   - updates of `maia_revisions_paused`;
   - member erasure in `app/api/members/delete-account/route.ts`.
   The trigger fires only on `UPDATE OF studio_path`, which the old reader never names.
4. **Target writer.** In the target, confirm that `studio_path` is written only by PATCH
   `app/api/sovereign/living-works/[id]/route.ts`. Confirm the PATCH accepts only a registered id, sets it once, and
   maps the FK and trigger errors to 4xx. Confirm nothing infers or backfills it.
5. **Prefix compatibility.** The single prefix 1 is compatible with the exact old reader still being live.
6. **Rollback.** The supported rollback is app-only: image rollback to `82a3543ae`, with the schema staying. Judge
   whether that is lossless. Then judge the guarded destructive `.rollback` file, which refuses while any Work carries
   a program.

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- This plan, and `MIGRATION_COMPATIBILITY_CONTEXT.json`.
- The migration and its rollback file.
- `scripts/deploy-production.sh` and `scripts/run-sql-migrations.sh`.
- Target files:
  - `app/api/sovereign/living-works/[id]/route.ts`
  - `app/api/sovereign/living-works/route.ts`
  - `lib/writersStudio/studioPaths.ts`
  - `lib/manuscript/editorialRuntime/workRevisionPause.ts`
  - `scripts/qa/prove-studio-path-migration.sh`
- Exact old-reader files:
  - `app/api/sovereign/living-works/[id]/route.ts`
  - `app/api/sovereign/living-works/route.ts`
  - `app/api/members/delete-account/route.ts`

## Required review JSON

Use the ordinary Review-Custody fields, plus `migration_compatibility` with:
- `instrument = migration-compatibility/v1`;
- the exact commits;
- `pending` = the one path with its SHA-256;
- the `old_reader_evidence` actually read;
- `failure_prefix_compatibility` with exactly **one** prefix entry bound to that path and SHA-256.

## Closing condition

An admitted `APPROVED` review with `COMPATIBLE` and `ALL_PREFIXES_COMPATIBLE` licenses the migrate-before-swap
sequence for this exact pending set only.
