# Deploy 2026-11-16: review plan for the exact two pending migrations (College Essay age attestation and stages)

**Date:** 2026-11-16
**Status:** BOUNDED INDEPENDENT REVIEW PLAN. NO DEPLOYMENT AUTHORITY BY ITSELF.

**Live old reader:** supplied by the harness through `MIGRATION_COMPATIBILITY_CONTEXT.json`. The reviewer establishes it
from the bundle, and the deploy lane re-witnesses it before mutation.

**Founder authorization (Kelly, 2026-11-16, in session; ledgers #1938 and #1900):**
- Minors: "if minors are using they must check off that they are under adult supervision" and "Yes, block under 13".
- Stages: "We want all phases of writing process for College essay ready to test", with notes "Yes, private by default".
- "Yes, merge and deploy", in reply to *"Merge #2309 and #2310 and deploy, through the migration review?"*.

Also in the target beyond #2309 and #2310:
- #2311 (another lane; coverage-line wording only, code only);
- #2312 (another lane's plan for migration 1 alone).

**This plan SUPERSEDES #2312's single-migration plan** (`docs/programme/*AGE_ATTESTATION_MIGRATION_REVIEW_PLAN_2026-11-16.md`). After #2310, main carries both migrations, so a plan for one of them no longer matches the pending set. The founder gave this session the deploy: "Yes, you own it" (2026-11-16).

## Exact target relation

The target is the canonical merge commit of the PR that adds this plan. It must differ from its own first parent only
by this documentation file, and that first parent must add no migration beyond the two below. The reviewer
establishes the relation from immutable git bytes where it can, and otherwise says so.

## Exact production-pending set, in order

1. `database/migrations/20261116000001_member_age_attestations.sql`
   sha256 `8b56b4753436db074fce78738da205a74f36a55e0080404b6910071feea1a9b9`
2. `database/migrations/20261116000002_living_work_studio_stage_and_notes.sql`
   sha256 `0bc1dc25d2b68130f459af24cfaff35aaa27339820ae51511054448280b89347`

Each has a sibling `_rollback.rollback` and carries its own `BEGIN … COMMIT` with `SET LOCAL lock_timeout = '5s'` first.

## What the migrations do

1. **`member_age_attestations`** (new table):
   - append-only; FK `members(id)` ON DELETE CASCADE;
   - CHECKs: `age_band IN ('adult','minor')`, a minor requires `supervision_attested`, and `studio_path` format;
   - a guard trigger refuses UPDATE, and refuses DELETE while the member exists;
   - TRUNCATE is refused;
   - there is no row shape for an under-13 answer.
2. **`living_works.studio_stage`** (new nullable column) with two CHECKs: the format, and *needs a program* (`studio_stage IS NULL OR studio_path IS NOT NULL`). **`studio_stage_notes`** (new table): FK `living_works` and `members` ON DELETE CASCADE; UNIQUE `(living_work_id, stage)`; body ≤ 20000 characters; `checks TEXT[]` with cardinality ≤ 20.

Neither migration changes existing data. Migration 2 adds two CHECK constraints to `living_works`; every existing row
satisfies them because the new column is NULL.

## Production facts supplied to the reviewer

Read-only, 2026-11-16, under `BEGIN READ ONLY`. Counts and schema only.
- **Live:** `4134cf2b2`, an ancestor of main.
- **Database:** PostgreSQL 16.13. The newest applied migration is `20261115000001_living_work_studio_path.sql`.
- **The objects:** neither `member_age_attestations` nor `studio_stage_notes` exists; `living_works.studio_stage` does not exist.
- **Row counts:** `members` 97; `living_works` 31, one of them with a program.

**Throwaway-cluster proofs** (2026-11-16), each run on PostgreSQL 14.19 and 16.15:
- `scripts/qa/prove-age-attestation-migration.sh`: 10/10;
- `scripts/qa/prove-studio-stage-migration.sh`: 9/9.

## Independent review questions

1. **Additive.** Confirm both migrations only create new objects, plus one nullable column and two CHECKs that existing rows satisfy, and change no existing data.
2. **Locking.** On a 31-row `living_works`, judge `ADD COLUMN` (nullable, no default) and `ADD CONSTRAINT … CHECK` (validated). Is `lock_timeout = '5s'` a safe failure mode?
3. **Old reader compatibility.** From the exact old reader, establish whether any statement on `living_works` or `members` could be affected. Particular cases:
   - member erasure (`app/api/members/delete-account/route.ts`): does the age-attestation guard trigger permit the ON DELETE CASCADE removal?
   - the Work PATCH: the old reader never writes `studio_stage`;
   - the Work list SELECTs.
4. **Target readers and writers.** In the target, confirm:
   - attestations are written only by `POST /api/sovereign/writers-studio/age-attestation` (adult, or minor with supervision);
   - the door (`arrival`) and Begin (PATCH `studioPath`) refuse without an admitting attestation, and fail closed;
   - `studio_stage` is written only by PATCH (a built stage of the Work's own program);
   - `studio_stage_notes` is read and written only by its owner-scoped route, and **no MAIA path reads it**.
5. **Prefix compatibility.** Prefix 1 (attestations only) and prefix 2 (both) are each compatible with the exact old reader still live.
6. **Rollback.** The supported rollback is app-only: image rollback to `4134cf2b2`, with the schema staying. Judge whether it is lossless, then judge both guarded destructive `.rollback` files.

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- This plan, and `MIGRATION_COMPATIBILITY_CONTEXT.json`.
- Both migrations and both rollback files.
- `scripts/deploy-production.sh` and `scripts/run-sql-migrations.sh`.
- Target files:
  - `app/api/sovereign/writers-studio/age-attestation/route.ts`
  - `lib/studios/ageAttestation.ts` and `lib/studios/ageAttestationRead.ts`
  - `app/api/sovereign/writers-studio/arrival/route.ts`
  - `app/api/sovereign/living-works/[id]/route.ts`
  - `app/api/sovereign/living-works/[id]/stage-notes/route.ts`
  - `app/api/sovereign/living-works/route.ts`
  - `lib/writersStudio/studioPaths.ts`
- Exact old-reader files:
  - `app/api/sovereign/living-works/[id]/route.ts`
  - `app/api/sovereign/living-works/route.ts`
  - `app/api/members/delete-account/route.ts`

## Required review JSON

Use the ordinary Review-Custody fields, plus `migration_compatibility` with:
- `instrument = migration-compatibility/v1`;
- the exact commits;
- `pending` = the two paths with their SHA-256 values, in order;
- the `old_reader_evidence` actually read;
- `failure_prefix_compatibility` with exactly **two** prefix entries, bound in order to those paths and SHA-256 values.

## Closing condition

An admitted `APPROVED` review with `COMPATIBLE` and `ALL_PREFIXES_COMPATIBLE` licenses the migrate-before-swap
sequence for this exact pending set only.
