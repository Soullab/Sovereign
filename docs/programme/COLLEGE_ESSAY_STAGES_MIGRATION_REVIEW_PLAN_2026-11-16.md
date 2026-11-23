# Deploy 2026-11-16: review plan for the exact one pending migration (College Essay stages and private notes)

**Date:** 2026-11-16
**Status:** BOUNDED INDEPENDENT REVIEW PLAN (revision 3 of the College Essay plans). NO DEPLOYMENT AUTHORITY BY ITSELF.

**Live old reader:** supplied by the harness through `MIGRATION_COMPATIBILITY_CONTEXT.json`. The reviewer establishes it
from the bundle, and the deploy lane re-witnesses it before mutation.

**Founder authorization (Kelly, 2026-11-16, in session; ledgers #1938 and #1900):**
- Stages: "We want all phases of writing process for College essay ready to test"; notes "Yes, private by default".
- "Yes, merge and deploy" (#2309, #2310); "Yes, you own it" (this session owns the College Essay deploy).
- **"Yes, run it"**, in reply to *"Run one more review cycle for just the stages migration, then deploy?"*

## Why revision 3

- **Revision 2** (`COLLEGE_ESSAY_TWO_MIGRATION_REVIEW_PLAN_2026-11-16.md`) covered two migrations against old reader `4134cf2b2`. It was **APPROVED** and admitted at `17481cd63`.
- Before it could be used, another session deployed `5f3733cb8` at 15:55Z under its own reviewed single-migration plan (#2312). That deploy **applied migration 1** (`20261116000001_member_age_attestations.sql`).
- The live reader and the pending set therefore changed, and revision 2's admitted review **no longer applies**. Under the review law it is not reused; this plan is new.

The findings dispositioned under revision 2 still hold:
- F1 and F3 are fixed in #2315, which is in this target;
- F2 (pre-existing program Works are not asked the age question) is founder-accepted.

## Exact target relation

The target is the canonical merge commit of the PR that adds this plan. It must differ from its own first parent only
by this documentation file, and that first parent must add no migration beyond the one below. The reviewer
establishes the relation from immutable git bytes where it can, and otherwise says so.

## Exact production-pending set

1. `database/migrations/20261116000002_living_work_studio_stage_and_notes.sql`
   sha256 `0bc1dc25d2b68130f459af24cfaff35aaa27339820ae51511054448280b89347`

It has a sibling `_rollback.rollback` and carries its own `BEGIN … COMMIT` with `SET LOCAL lock_timeout = '5s'` first.

## What the migration does

- **`living_works.studio_stage`:** a new nullable column, with two CHECKs: the format, and *needs a program* (`studio_stage IS NULL OR studio_path IS NOT NULL`).
- **`studio_stage_notes`:** a new table.
  - FK `living_works(id)` and `members(id)` ON DELETE CASCADE;
  - UNIQUE `(living_work_id, stage)`;
  - body ≤ 20000 characters;
  - `checks TEXT[]` with cardinality ≤ 20.

It changes no existing data. The two CHECKs hold for every existing row because the new column is NULL.

## Production facts supplied to the reviewer

Read-only, 2026-11-16, under `BEGIN READ ONLY`. Counts and schema only.
- **Live:** `5f3733cb8` (DEPLOY_LANE `deploy-lane`, created 15:55:57Z), an ancestor of main.
- **Database:** PostgreSQL 16.13. The newest applied migration is `20261116000001_member_age_attestations.sql`.
- **The objects:** `studio_stage_notes` does not exist; `living_works.studio_stage` does not exist.
- **Row counts:** `members` 97; `living_works` 31, one of them with a program; `member_age_attestations` 0.

**Throwaway-cluster proof:** `scripts/qa/prove-studio-stage-migration.sh` passed 9/9 on PostgreSQL 14.19 and on 16.15 (2026-11-16, after #2315).

## Independent review questions

1. **Additive.** Confirm the migration only creates new objects plus one nullable column and two CHECKs that existing rows satisfy, and changes no existing data.
2. **Locking.** On a 31-row `living_works`, judge `ADD COLUMN` (nullable, no default) and `ADD CONSTRAINT … CHECK` (validated). Is `lock_timeout = '5s'` a safe failure mode?
3. **Old reader compatibility.** From the exact old reader `5f3733cb8`, establish whether any statement on `living_works` or `members` could be affected. Particular cases:
   - the Work PATCH, including its `studioPath` and age-attestation path;
   - the Work list SELECTs;
   - member and Work erasure: does the new cascading table block or change them?
4. **Target readers and writers.** In the target, confirm:
   - `studio_stage` is written only by PATCH (a built stage of the Work's own program);
   - `studio_stage_notes` is read and written only by its owner-scoped route, and **no MAIA path reads it**;
   - the Work Delete and Remove confirmations name "your stage notes" (#2315).
5. **Prefix compatibility.** The single prefix 1 is compatible with the exact old reader still being live.
6. **Rollback.** The supported rollback is app-only: image rollback to `5f3733cb8`, with the schema staying. Judge whether it is lossless, then judge the guarded destructive `.rollback` file.

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- This plan, and `MIGRATION_COMPATIBILITY_CONTEXT.json`.
- The migration and its rollback file.
- `scripts/deploy-production.sh` and `scripts/run-sql-migrations.sh`.
- Target files:
  - `app/api/sovereign/living-works/[id]/route.ts`
  - `app/api/sovereign/living-works/[id]/stage-notes/route.ts`
  - `app/api/sovereign/living-works/route.ts`
  - `lib/writersStudio/studioPaths.ts`
  - `lib/writersStudio/deleteWork.ts`
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
