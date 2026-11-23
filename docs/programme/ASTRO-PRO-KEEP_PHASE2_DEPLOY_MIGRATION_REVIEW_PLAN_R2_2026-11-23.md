# ASTRO-PRO-KEEP Phase 2 deploy 2026-11-23: review plan R2 for its one migration

**Date:** 2026-11-23
**Status:** BOUNDED INDEPENDENT REVIEW PLAN. This plan gives no deployment authority by itself.
**Live old reader:** the harness supplies it through the bundle's `MIGRATION_COMPATIBILITY_CONTEXT.json`.
It is deliberately not embedded here, because a plan that names a live release goes stale when
another lane deploys. The reviewer establishes the exact old reader from the bundle, and the deploy
lane re-witnesses it immediately before mutation.
**Founder authorization:** Kelly, 2026-11-23, in session: "Yes, deploy after review". This covers
deploying canonical `clean-main-no-secrets`, which since the live release has gained exactly two
merges:
- PR #1741 (`5f585217d`): the P6 return-authority write-site repair. Code only, no migration.
- PR #2379 (`a3c1969eb`): ASTRO-PRO-KEEP Phase 2. One migration.

## Why there is an R2

The first plan (`ASTRO-PRO-KEEP_PHASE2_DEPLOY_MIGRATION_REVIEW_PLAN_2026-11-23.md`) is left
byte-for-byte as reviewed. Its review was bound to target `f0cae2cf1`, and the verdict was
**REVISE**: the migration was COMPATIBLE and ALL_PREFIXES_COMPATIBLE, but there was one high code
finding.

- **F1.** The Ask route did not bind the stored `subjectKey` to the chart computed, so client material
  could be carried as own-chart.
- **F2.** The prompt loader dropped the carried reading.
- **F3.** Erasure wording.
- **F4.** The rollback script had no `lock_timeout`.
- **F6.** A stale comment.

A follow-up PR fixed F1, F2, F4 and F6 and corrected F3's wording; F5 is recorded. **The migration
file is unchanged** (same SHA-256). Per the verdict-plurality rule, REVISE is not converted: this is a
new review of a new target.

## Exact target relation

The harness supplies the deployment target externally. The target must contain this plan and the
migration below. The gate reads the plan from the target commit, so the target is the canonical
commit that merges the review-fix PR (which also adds this plan) on top of `f0cae2cf1`. The reviewer
should treat the diff from `f0cae2cf1` as code that needs review, not as documentation only. The reviewer establishes the exact relation from immutable git bytes where it can,
and otherwise says so. Any movement after review invalidates applicability.

## Exact production-pending set

As read from the production ledger (`schema_migrations`), one migration is pending:

1. `database/migrations/20261123000001_astro_pro_keep_phase2.sql`
   sha256 `cb6f759e027238c2881230a5e0102630c29824bed0bd3c672288155d746aaf2d`

Next to it is `database/migrations/20261123000001_astro_pro_keep_phase2_rollback.rollback`. It is
a manual rollback script, not a `.sql` migration. The reviewer should confirm from
`scripts/run-sql-migrations.sh` that the runner does not select it.

## What the migration does

The migration opens `BEGIN`, then `SET LOCAL lock_timeout = '5s'`, then does three things:

1. It refuses unless `astro_pro_turns` exists (Phase 1 prerequisite).
2. It adds a column to the existing table `astro_pro_turns`:
   `id uuid NOT NULL DEFAULT gen_random_uuid()`. With a volatile default, this rewrites the table
   and takes an ACCESS EXCLUSIVE lock. The table has a row-level BEFORE UPDATE append-only trigger;
   a column add does not fire row triggers. The migration also creates a unique index on `id`.
3. On `member_memory_atoms`, it replaces the `source_type` CHECK with the eleven existing values
   plus `astro_pro_exchange`. Before doing so, it runs a guard that raises if any row holds a value
   outside the new set. Re-adding the CHECK takes an ACCESS EXCLUSIVE lock and validates every row.

It uses `IF NOT EXISTS` / `DROP … IF EXISTS`, so a re-run is safe. There is no data backfill and no
atom is created.

## Production facts supplied to the reviewer

These were read-only and are counts and schema only, taken 2026-11-23 ~15:50Z. They contain no
member content.

- PostgreSQL 16.13. `gen_random_uuid()` is available.
- `astro_pro_turns` columns: `thread_id uuid, turn_index integer, speaker text, body text,
  created_at timestamptz`. Index: `astro_pro_turns_pkey`. Trigger: `astro_pro_turns_no_update`.
  It has **0 rows**, and `astro_pro_threads` has **0 rows**.
- `member_memory_atoms`: **143 rows**.
  - By `source_type`: `idea` 26, `idea_block` 104, `practitioner_observation` 12, `spontaneous` 1.
  - The current CHECK admits exactly `idea, idea_block, journal, dream, reflection, decision,
    change, session_excerpt, spontaneous, practitioner_observation, capsule`.
  - The columns `provenance`, `epistemological_status`, `return_preference` and `memory_scope` exist.
  - The `return_preference` default is `'member_pulled'`. By `return_preference`:
    `contextual_doorway` 141, `member_pulled` 2.
- Ledger: the newest applied migration is `20261122000001_astro_pro_conversations.sql`, and
  `20261123000001` is not recorded.

## Deployment ordering (as implemented in `scripts/deploy-production.sh`)

1. Exact target materialization.
2. Build and pre-swap image provenance.
3. Admitted migration review, compatibility and all-prefix compatibility.
4. Exact pending-set re-witness.
5. Exact old-reader re-witness.
6. The migration runs, **while the old reader is live**.
7. Rollback tags and candidate swap.
8. Running provenance, health and smoke tests.

A failed migration must leave the candidate unswapped and the old reader live.

## Independent review questions

1. **Additive.** Establish that the migration drops, rewrites or backfills no existing data. The
   CHECK replacement must be a strict superset of the production set above, and every existing row
   must satisfy it.
2. **Lock-timeout law.** `lock_timeout` must be set inside the transaction before any DDL. Judge the
   lock risk of two things: the `astro_pro_turns` rewrite (0 rows) and the CHECK re-validation over
   143 rows of `member_memory_atoms`, a table the live reader reads on most MAIA turns.
3. **Old reader and `astro_pro_turns.id`.**
   - Do the old reader's INSERTs into `astro_pro_turns` name their columns, so the new defaulted
     column is filled?
   - Do its reads tolerate an extra column?
   - Does anything in the old reader `SELECT *` from it and depend on the column set?
4. **Old reader and the widened CHECK.** The old reader never writes `astro_pro_exchange`. Confirm
   that its `member_memory_atoms` writers are unaffected.
5. **Prefix compatibility.** There is one migration and one transaction, so prefix 1 is the whole
   set. Establish that it is compatible with the exact old reader still being live.
6. **Target reader against the final schema.**
   - The target's `keepSource` (`lib/psyche/portfolio.ts`, with `lib/psyche/returnAuthority.ts`)
     writes `return_preference` explicitly for every keep. For an `astro_pro_exchange` keep it also
     writes `provenance` (jsonb) and `epistemological_status = 'inferred'`. Do these statements
     match the columns and their CHECKs? Read the migrations that define them where needed.
   - Do the target's `lib/astrology/proConversationStore.ts` reads of `astro_pro_turns.id` and its
     `EXISTS` on `member_memory_atoms` match the final schema?
   - Does the carry route (`app/api/astrology/pro/conversation/carry/route.ts`) write only through
     `keepSource`?
7. **Consent.** From the target code:
   - Is an `astro_pro_exchange` atom created only by the member's own press, and only for a
     single-chart own-chart thread with Keep on?
   - Can any client (saved-chart) material become an atom?
   - Is the P6 change (#1741) consistent with "Keeping is the consent act", meaning a member's own
     keep returns as `contextual_doorway` and no non-member writer can confer it?
8. **Erasure.** Confirm what the target account deletion (`app/api/members/delete-account/route.ts`)
   does: atoms go by cascade with the member row, and Pro threads cause a fail-closed 409 refusal
   (Phase 1 behaviour). Confirm that the corrected design text says so.
9. **Rollback.** Rollback is `scripts/deploy-production.sh rollback` to the previous image, with
   the schema left in place. Judge what the old reader does with rows the target wrote:
   - an `astro_pro_exchange` atom, in the old `lib/maia/memoryAtomsLoader.ts` rendering and the
     old Keep page;
   - keeps written as `contextual_doorway` by the target.

   Also judge whether the manual `.rollback` script is safe: it refuses while any
   `astro_pro_exchange` atom exists.

10. **R1 fixes.**
    - Does the target Ask route (`app/api/astrology/pro/ask/route.ts`) now refuse any `subjectKey`
      that is not exactly the key computed from the validated `section`, `subject` and (for
      two-chart sections only) `other`, before anything is stored?
    - Does it refuse `other` on single-chart sections?
    - Can any path still store a client or two-chart exchange in a thread whose key reads own-chart,
      single-chart?
    - Does `loadMemberMemoryAtomsForPrompt` now carry an `astro_pro_exchange` body while still
      withholding sourced atoms' bodies?
    - Are the new tests meaningful?
    - The live old reader stores unbound keys. The deploy lane re-witnesses `astro_pro_threads`
      immediately before mutation and stops if any thread exists. Judge whether that closes the
      pre-fix-thread question.

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- this plan;
- `MIGRATION_COMPATIBILITY_CONTEXT.json`;
- `database/migrations/20261123000001_astro_pro_keep_phase2.sql`;
- `database/migrations/20261123000001_astro_pro_keep_phase2_rollback.rollback`;
- `database/migrations/20261122000001_astro_pro_conversations.sql`;
- `scripts/deploy-production.sh`;
- `scripts/run-sql-migrations.sh`;
- target `lib/psyche/portfolio.ts`;
- target `lib/psyche/returnAuthority.ts`;
- target `lib/astrology/proConversationStore.ts`;
- target `app/api/astrology/pro/conversation/carry/route.ts`;
- target `lib/maia/memoryAtomsLoader.ts`;
- target `app/api/members/delete-account/route.ts`;
- target `app/api/astrology/pro/ask/route.ts`;
- target `app/api/astrology/pro/ask/__tests__/proAsk.test.ts`;
- target `lib/psyche/__tests__/astroProExchangeKeep.test.ts`;
- target `docs/programme/ASTRO-PRO-KEEP_PHASE2_MEMORY_DESIGN_2026-11-23.md`;
- exact old-reader `app/api/astrology/pro/ask/route.ts`;
- exact old-reader `lib/astrology/proConversationStore.ts`;
- exact old-reader `lib/psyche/portfolio.ts`;
- exact old-reader `lib/maia/memoryAtomsLoader.ts`.

Old-reader paths live beneath `old-reader/<exact-old-reader-SHA>/...` in the bundle. Search may
help find files but does not count as coverage.

## Required review JSON

The review carries the ordinary Review-Custody fields: `verdict`, `plan_sha256`, `trace_id` (the
reviewer session id), `reviewer`, `summary`, `findings`, `coverage.files` and `limitations`.

It also carries `migration_compatibility`:
- `instrument = migration-compatibility/v1`;
- `verdict` COMPATIBLE or INCOMPATIBLE;
- the exact full old-reader and target commits;
- `pending` = the one path with its SHA-256;
- `old_reader_evidence` = the old-reader files read, each with repo path, SHA-256 and trace path;
- `rationale` and `limitations`;
- `failure_prefix_compatibility`, with `instrument = migration-prefix-compatibility/v1`. Its verdict
  may be `ALL_PREFIXES_COMPATIBLE` only if the prefix is established. It holds exactly **one**
  prefix entry, bound to the migration's path and SHA-256, with `through_path`, `through_sha256`,
  `rationale` and `limitations`.

## Existing evidence may inform, not substitute

- **Review-fix PR:** 743 affected tests pass, with no TypeScript regressions.
- **PR #2379:** 701 affected tests pass and there are no TypeScript regressions. CI was green,
  including "Empty database reconstruction". The migration was applied to a disposable PostgreSQL
  17 database and re-applied cleanly. On it, the rollback refused while a carried atom existed and
  ran cleanly once none did.
- **PR #1741:** 56/56 P6, psyche and loader tests. It merged by auto-merge. No independent Class
  A/R20 code review of #1741 or #2379 was performed; the founder authorized the deploy regardless.

This review covers the migration act only.

## Closing condition

An admitted `APPROVED` review with `COMPATIBLE` and `ALL_PREFIXES_COMPATIBLE` licenses the
migrate-before-swap sequence above for this exact pending set and no other. It is not a statement
that the migration or the feature is correct.
