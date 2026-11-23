# ASTRO-PRO-KEEP Phase 2 deploy 2026-11-23: review plan R4 for its one migration

**Date:** 2026-11-23
**Status:** BOUNDED INDEPENDENT REVIEW PLAN. This plan gives no deployment authority by itself.
**Live old reader:** the harness supplies it through the bundle's `MIGRATION_COMPATIBILITY_CONTEXT.json`.
It is deliberately not embedded here, because a plan that names a live release goes stale when
another lane deploys. The reviewer establishes the exact old reader from the bundle, and the deploy
lane re-witnesses it immediately before mutation.
**Founder authorization:** Kelly, 2026-11-23, in session: "Yes, deploy after review", for the
Pro Astrology work below. Later that day Kelly chose to **hold the release** until the other changes
in the candidate are cleared in their own lanes. This plan authorizes no release; a release needs
Kelly's explicit GO for the exact final commit.

## Release candidate scope (corrected in R3)

A deploy ships everything on canonical between the live release and the candidate, not only this
lane's work. Production was re-read at `1c70c3c6f` on 2026-11-23 ~17:05Z. As of canonical
`a74e83552`, the first-parent merges since the live release are:

| Merge | PR | Lane | Migrations | Release clearance |
|---|---|---|---|---|
| `5f585217d` | #1741 P6 return-authority repair | Memory / P6 | none | reviewed by this plan only as it bears on `keepSource` |
| `a3c1969eb` | #2379 ASTRO-PRO-KEEP Phase 2 | Astrology | `20261123000001` | **this plan** |
| `f0cae2cf1` | #2381 review plan 1 | Astrology | none (docs) | this plan |
| `3d6e310d9` | #2380 passage conversation keeps the writer's words | Writer's Studio | none | **held: independent Class A/R20 review owed** |
| `f3cfccdf9` | #2382 Phase 2 review fixes | Astrology | none (fixes code) | **this plan** |
| `a74e83552` | #2383 Keep my words | Writer's Studio | none | **held: classification and manuscript-write review owed** |
| `145332573` | #2384 review plan R3 | Astrology | none (docs) | this plan |
| `5643b526f` | #2385 passage correction review | Writer's Studio | none | Writer's Studio lane |

**Writer's Studio clearance, as recorded at R4 (2026-11-23 ~18:00Z).** Kelly stated in session
"cleared". At that time release ledger #1938 had no clearance entry for #2380 or #2383, and neither
PR had a submitted GitHub review. This plan does not judge Writer's Studio. The founder's GO for the
exact release commit is where that clearance is weighed.

Plus this plan's own merge (#2386 or later) and any later merge. A GitHub comparison counts these as 26
commits and 49 files. **The reviewer must enumerate the candidate's pending migrations from the
bundle**, not from this table. If any migration other than `20261123000001` is pending, the
review is out of scope and must return BLOCKED.

This review covers only the migration act and the Pro Astrology / P6 code it names. It gives **no**
clearance to #2380, #2383 or any other change. Each is a separate precondition of the release.
Any merge after this review's target changes the candidate and needs the scope reassessed.

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

## Why there is an R4

Plan R3 is left byte-for-byte as reviewed. Its review was bound to target `145332573` and returned
**REVISE**: the migration was COMPATIBLE and ALL_PREFIXES_COMPATIBLE, and the pending set held only
`20261123000001`. There was one medium finding and three low ones.

- **R3-F1 (medium).** The pre-deploy count cannot see a thread the old reader opens after the
  count and before the swap. Such a thread would carry an unbound key that the target's carry path
  trusts. **The finding is accepted, with the reviewer's control:** a second read-only count after
  the swap (see "Operator stop condition"). No code or script change.
- **R3-F2 (low).** After a rollback, the old loader renders a carried atom as the member's question
  only, as member-placed. Recorded (as R2-F2 / R1 F5).
- **R3-F3 (low).** The tests mock the database. Recorded (as R2-F3).
- **R3-F4 (low).** The design said the turn id is "backfilled"; it is set by a column default.
  Recorded here as a wording error in the design; the migration is correct.

## Why there was an R3

Plan R2 is left byte-for-byte as reviewed. Its review was bound to target `f3cfccdf9` and returned
**APPROVED**: the migration was COMPATIBLE and ALL_PREFIXES_COMPATIBLE. The Review Custody gate
refused to admit it (`MATERIAL_UNDER_APPROVED`) because of one medium finding. Disposition:

- **R2-F1 (medium).** Plan R2 said "the deploy lane re-witnesses `astro_pro_threads`". In fact,
  `scripts/deploy-production.sh` re-witnesses only the pending set and the live reader. **The finding
  is accepted and the plan is corrected.** The re-witness is a named manual operator step (see
  "Operator stop condition" below) and is recorded in the production witness. The deploy script is
  not changed; that would be a separate, reviewed infrastructure change.
- **R2-F2 (low).** No rollback guard exists for the old reader. Recorded, as before (R1 F5).
- **R2-F3 (low).** The Phase 2 tests mock the database. Recorded. The disposable-database run in
  PR #2379 and the "Empty database reconstruction" CI check are the existing database-level
  evidence; a device walk is owed after deploy.

The target for this R3 review is the frozen release candidate at the time of review (see "Release
candidate scope").

## Operator stop conditions (manual, not in the deploy script)

**Before the deploy (S1):**

Immediately before running `scripts/deploy-production.sh deploy <target>`, the operator runs a
read-only count of `astro_pro_threads` on production. The deploy goes ahead only if it is **0**,
and the count and time are recorded in the production witness. If it is not 0, the operator stops.
Threads written by the old reader carry an unbound key, so a carry from them is not trustworthy;
they need a separate disposition before any deploy. Between that count and the swap, the old reader
could still open a thread. That window is minutes long. S2 closes it.

**After the swap (S2):** once running provenance is verified on the target, the operator counts the
`astro_pro_threads` rows whose `opened_at` (defined in `20261122000001`) is earlier than the new
`maia-sovereign` container's start time, and records the count and time in the production witness.
If the count is not 0, those threads were written by the unbound old reader. The operator then:
- holds them for founder disposition before any carry from them is relied on;
- lists any `astro_pro_exchange` atoms whose `provenance.thread_id` points at them;
- tells Kelly.

The operator reads counts and ids only, never conversation content.

## Exact target relation

The harness supplies the deployment target externally. The target must contain this plan and the
migration below. The gate reads the plan from the target commit, so the target is the canonical
commit that merges the review-fix PR on top of `f0cae2cf1`; it also includes this plan and any later canonical merges named in the bundle. The reviewer
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
    - The live old reader stores unbound keys. The operator stop condition above (a manual count,
      not a script step) is the control. **Give an explicit disposition of the residual window**
      (the old reader opening a thread between the count and the swap): acceptable as recorded,
      acceptable only with a named extra control, or not acceptable. The control is now S1 plus
      S2. Judge whether S2 closes the window. A material finding here means REVISE.

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
