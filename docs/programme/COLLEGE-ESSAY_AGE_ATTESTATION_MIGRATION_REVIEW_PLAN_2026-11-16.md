# College Essay age attestation 2026-11-16 — exact one-migration review plan

**Date:** 2026-11-16
**Status:** BOUNDED INDEPENDENT REVIEW PLAN · NO DEPLOYMENT AUTHORITY BY ITSELF
**Live old reader:** supplied externally by the harness through the bundle's
`MIGRATION_COMPATIBILITY_CONTEXT.json`, deliberately not embedded here (a plan that names a live
release goes stale when another lane deploys). The reviewer establishes the exact old reader from
the bundle; the deploy lane re-witnesses it immediately before mutation.
**Why this plan exists:** `scripts/deploy-production.sh deploy 3c59f1bf7` (founder-run, 2026-11-16)
built and then refused at the Review Custody gate before any mutation: one migration was pending
and no bound review existed. Production was verified unchanged afterwards. This plan is the lawful
route through that gate. It is not a founder authorization to deploy; the founder runs the deploy.

## Exact target relation

The harness supplies the deployment target externally. The target must contain this plan and the
migration below. Because the gate reads the plan from the target commit, the target is the
canonical commit that adds this plan on top of `3c59f1bf71b11b37dc0e9ed5938b7193a46d0e80`; it must
differ from `3c59f1bf7` only by this document. The reviewer establishes the relation from immutable
git bytes where it can, and otherwise says so. Any movement after review invalidates applicability.

## Exact production-pending set

The refused deploy's own preflight listed exactly one pending migration:

1. `database/migrations/20261116000001_member_age_attestations.sql`
   sha256 `8b56b4753436db074fce78738da205a74f36a55e0080404b6910071feea1a9b9`

Its companion `database/migrations/20261116000001_member_age_attestations_rollback.rollback`
(sha256 `121e62f8a2473bdc7fbbb6a4ca396db29fbbe66533e03246ab78b60ce91a1c08`) is not a `.sql` file and
is not executed by the runner; it is in scope for question 7 only. The migration carries its own
`BEGIN … COMMIT`, so there is exactly one committed prefix.

## What the migration does

Creates one new table, `member_age_attestations` (append-only, self-attested age band at a Studio
program door; PR #2309; founder ruling 2026-11-16 recorded in the file header):

- columns `id BIGSERIAL PK`, `member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE`,
  `age_band TEXT CHECK IN ('adult','minor')`, `supervision_attested BOOLEAN NOT NULL`,
  `studio_path TEXT` (NULL or a lowercase slug), `attested_at TIMESTAMPTZ DEFAULT now()`, and a
  CHECK that a `minor` row always carries `supervision_attested`;
- index `idx_member_age_attestations_member_latest (member_id, id DESC)`;
- BEFORE UPDATE OR DELETE row trigger `member_age_attestations_guard`: refuses every UPDATE, and
  refuses a DELETE while the member row still exists (so rows go only with their member);
- BEFORE TRUNCATE statement trigger refusing TRUNCATE;
- a table comment.

It opens `BEGIN` then `SET LOCAL lock_timeout = '5s'`, and uses `IF NOT EXISTS` /
`CREATE OR REPLACE` / `DROP TRIGGER IF EXISTS`. It alters no existing table, column, constraint or
row. The only existing object it touches is `members`, as the referenced table of a new foreign key.

## Production facts supplied to the reviewer

Read-only, schema and counts only, taken 2026-11-16 ~14:40Z; no member content:

- `member_age_attestations` does not exist; no function named `member_age_attestations%` exists.
- `members.id` is `uuid`; `members` has 97 rows.
- Ledger: newest applied is `20261115000001_living_work_studio_path.sql`; nothing matching
  `20261116000001%` is recorded.
- PostgreSQL `16.13`.

## Deployment ordering (as implemented in `scripts/deploy-production.sh`)

1. exact target materialization; 2. build and pre-swap image provenance; 3. admitted migration
review, compatibility and all-prefix compatibility; 4. exact pending-set re-witness; 5. exact
old-reader re-witness; 6. the migration, **while the old reader is live**; 7. rollback tags and
candidate swap; 8. running provenance, health and smoke tests. A failed migration must leave the
candidate unswapped and the old reader live.

## Independent review questions

1. **Additive.** Establish that the migration drops, rewrites or backfills no existing data and
   alters no existing table.
2. **Lock-timeout law.** `lock_timeout` is set inside the transaction before any DDL. Adding a
   foreign key to `members` takes a lock on `members`; judge what lock, for how long, and the risk
   to a live old reader with 97 member rows.
3. **Cascade versus the guard trigger.** When a member row is deleted, `ON DELETE CASCADE` deletes
   their attestations and the BEFORE DELETE guard fires on each. Establish from PostgreSQL
   semantics and the bytes whether the guard's `EXISTS (SELECT 1 FROM members WHERE id = OLD.member_id)`
   sees the member as already gone at that point, so that member erasure succeeds rather than
   being refused. This is load-bearing for R20 (erasure must work).
4. **Old reader in the window.** Between migration and swap the table is empty and the old reader
   never names it. Establish that no old-reader path (in particular its account deletion,
   `DELETE FROM members`) is affected.
5. **Prefix compatibility.** The single prefix (after migration 1) is compatible with the exact
   old reader still being live.
6. **Target reader against the schema.** The target's writer and reader
   (`lib/studios/ageAttestation.ts`, `lib/studios/ageAttestationRead.ts`) and routes
   (`app/api/sovereign/writers-studio/age-attestation/route.ts`,
   `app/api/sovereign/writers-studio/arrival/route.ts`,
   `app/api/sovereign/living-works/[id]/route.ts`) issue statements consistent with the columns,
   CHECKs and triggers; nothing is written without the member's own act; nothing is stored for an
   under-13 answer; an unreadable record fails closed; the target's account deletion
   (`app/api/members/delete-account/route.ts`) still erases a member who has attestations.
7. **Rollback.** The supported rollback is `scripts/deploy-production.sh rollback` to the previous
   image with the table left in place. Judge what the old reader does with rows the target wrote
   (expected: never reads them; College Essay becomes ungated again), whether old-reader account
   deletion still succeeds for a member with attestation rows (question 3 again, from the old
   reader's side), and whether the guarded `.rollback` file refuses while rows exist. Name what is
   lost or blocked.
8. **Member-visible change and consent (target).** What a member newly meets, and whether any row
   can be created without that member's own gesture. This is a Class A surface (minors,
   supervision); report concerns as findings, but this review covers the migration act and its
   readers, not the full Class A product decision, which the founder ruled.

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- this plan;
- `MIGRATION_COMPATIBILITY_CONTEXT.json`;
- `database/migrations/20261116000001_member_age_attestations.sql`;
- `database/migrations/20261116000001_member_age_attestations_rollback.rollback`;
- `scripts/deploy-production.sh`;
- `scripts/run-sql-migrations.sh`;
- `scripts/qa/prove-age-attestation-migration.sh`;
- target `lib/studios/ageAttestation.ts`;
- target `lib/studios/ageAttestationRead.ts`;
- target `app/api/sovereign/writers-studio/age-attestation/route.ts`;
- target `app/api/sovereign/writers-studio/arrival/route.ts`;
- target `app/api/sovereign/living-works/[id]/route.ts`;
- target `app/api/members/delete-account/route.ts`;
- exact old-reader `app/api/members/delete-account/route.ts`;
- exact old-reader `app/api/sovereign/living-works/[id]/route.ts`;
- exact old-reader `app/api/sovereign/writers-studio/arrival/route.ts`.

Old-reader paths live beneath `old-reader/<exact-old-reader-SHA>/...` in the bundle. Search may
help find files but does not count as coverage.

## Required review JSON

Ordinary Review-Custody fields (`verdict`, `plan_sha256`, `trace_id` = reviewer session id,
`reviewer`, `summary`, `findings`, `coverage.files`, `limitations`) and `migration_compatibility`
(`instrument = migration-compatibility/v1`; `verdict` COMPATIBLE or INCOMPATIBLE; exact full
old-reader and target commits; `pending` = the one path with its SHA-256 above;
`old_reader_evidence` = old-reader files read, each with repo path, SHA-256 and trace path;
`rationale`; `limitations`; `failure_prefix_compatibility` with
`instrument = migration-prefix-compatibility/v1`, verdict `ALL_PREFIXES_COMPATIBLE` only if the
prefix is established, and exactly **one** prefix entry bound to the migration's path and SHA-256,
with `through_path`, `through_sha256`, `rationale`, `limitations`).

## Existing evidence may inform, not substitute

PR #2309 reports `scripts/qa/prove-age-attestation-migration.sh` (throwaway cluster, the real
migration and rollback files) at 10/10 on PostgreSQL 14.19 and 16.15, including "erasing a member
removes their attestations" and "the destructive schema rollback refuses while attestations
exist"; and route tests for the 403 `age_attestation_required` gate. PR #2309 is labelled Class A
and Class B with `covenant-signoff`; under the beta-phase rule the founder is the sole Class A
authority. This review covers the migration act only.

## Closing condition

An admitted `APPROVED` review with `COMPATIBLE` and `ALL_PREFIXES_COMPATIBLE` licenses the
migrate-before-swap sequence above for this exact pending set and no other. It is not a statement
that the migration or the feature is correct.
