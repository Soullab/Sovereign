# Pro Studio grants deploy 2026-11-27: review plan for its one migration

**Founder authorization:** Kelly, in session on 2026-11-27: "Yes, review and deploy". That covers an
independent migration review and, if it is admitted, a full deploy of canonical with this migration.
This plan authorizes nothing by itself. An admitted review licenses one migrate-before-swap sequence
for the exact pending set below, and no other.

## Release candidate scope

The running reader is `68d6b6eaf` ("old reader"). It is `6c1c7e51b` plus one cherry-picked commit, the
Home sky-row fix of #2445. It was deployed on its own so that #2441's migration would wait for this
review.

The target is the canonical commit that merges this plan's PR. That PR also merges `68d6b6eaf` into
canonical, so the target descends from the running reader, as the deploy's ancestry gate requires.
The merge of `68d6b6eaf` adds no content, because canonical already carries the same change through
#2445.

First-parent merges on canonical since `6c1c7e51b`, as observed by the harness through `git log`:

| PR | What it touches | Application code? |
|---|---|---|
| #2441 | Pro Studio grant: `lib/proStudio/grant.ts`, `app/pro-studio/page.tsx`, `lib/house/entrance.ts`, this migration and its rollback, design doc | yes |
| #2428 | JARVIS agent docs and `.claude/agents` | no |
| #2445 | Home one-line sky row opens Pro Astrology for Pro members (already live in `68d6b6eaf`) | yes, already running |
| #2406 | Reflections design doc | no |
| #2443 | JARVIS isolation profile settings and manual | no |
| #2449 | Home "Your Pro rooms": `lib/house/proRooms.ts`, `app/house/page.tsx`, House CSS and tests | yes |
| #2447 | Year-ahead report cites transits: `lib/soulPortrait/generator/*` | yes, does not read or write `pro_studio_grants` |
| this PR | this plan, and the merge of `68d6b6eaf` | no |

The reviewer should treat the target's application diff from the old reader as code that needs
review where it reads or writes `pro_studio_grants`.

## Exact production-pending set

From the production ledger (`schema_migrations`), read 2026-11-27 17:56Z: the newest applied
migration is `20261123000001_astro_pro_keep_phase2.sql`, and no `20261127%` row exists. One
migration is pending:

1. `database/migrations/20261127000001_pro_studio_grants.sql`
   sha256 `503c47555c0840a6699c2200e51fd3f4f61209791603eaaa0f29086796b588a3`

Next to it is `database/migrations/20261127000001_pro_studio_grants_rollback.rollback`. It is a
manual rollback script, not a `.sql` migration. The reviewer should confirm from
`scripts/run-sql-migrations.sh` that the runner does not select it. If the bundle shows any other
pending migration, the verdict is BLOCKED.

## What the migration does

Inside `BEGIN` with `SET LOCAL lock_timeout = '5s'`:

1. It refuses unless `members` exists.
2. It creates a **new** table `pro_studio_grants`. The table references `members(id)` three times, all
   `ON DELETE RESTRICT`: `member_id`, `granted_by_member_id` and `revoked_by_member_id`. It has
   CHECKs for the path set, no self-grant, the time window and the revocation pair.
3. It creates a partial index on unrevoked rows.
4. It creates a guard function and BEFORE UPDATE and BEFORE DELETE triggers. Together they make
   the table append-only, and revocation is the only permitted update.
5. It adds comments, then runs a post-create shape check.

It does not alter any existing table, and it writes no rows.

## Production facts supplied to the reviewer

These were read-only, taken 2026-11-27 17:56Z, and are counts and schema only:

- PostgreSQL 16.13. `gen_random_uuid()` is available.
- `members.id` is `uuid`. `members` has 97 rows.
- `pro_studio_grants` does not exist.
- The running container reports `GIT_COMMIT=68d6b6eaf`.

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

1. **Additive.** Establish that the migration creates only new objects, and that it alters, drops,
   rewrites or backfills no existing table or data.
2. **Lock-timeout law.** `lock_timeout` must be set inside the transaction before any DDL. Judge the
   lock taken on `members` by the three foreign keys. Creating a referencing FK takes a SHARE ROW
   EXCLUSIVE lock on `members`, a table the live reader reads on most requests.
3. **Old reader.** Establish from the exact old-reader files that the old reader never reads or
   writes `pro_studio_grants`. Then judge the one way the new table can affect it: the RESTRICT
   foreign keys on `members`. The table is empty between the migration and the swap, so no RESTRICT
   can fire in that window. Confirm this.
4. **Prefix compatibility.** One migration in one transaction, so prefix 1 is the whole set.
   Establish that it is compatible with the exact old reader still being live.
5. **Target reader against the final schema.**
   - Does `lib/proStudio/grant.ts` (`CURRENT_GRANT_SQL`) match the columns, and does it fail closed
     (`absent`) when the table is unreadable?
   - Do `app/pro-studio/page.tsx`, `lib/house/entrance.ts` and `lib/house/proRooms.ts` yield the full
     workspace or a Home door only on `entitlement === 'verified'`?
   - Does any target code write `pro_studio_grants`? If no writer exists, grants are written by a
     steward outside the app; say so.
6. **Access.** Can a member grant to themselves, or can any client value reach the grant reader as
   the member id? Does the grant confer anything beyond the Pro Studio workspace and the Home door,
   such as client data or Co-Lab permissions?
7. **Erasure.** With RESTRICT foreign keys, a member who holds, gave or revoked a grant cannot be
   deleted through `DELETE FROM members`. Read the target `app/api/members/delete-account/route.ts`.
   Does it refuse such a deletion as a held refusal, with nothing changed and no false
   "try again"? Is that acceptable, or is it a finding?
8. **Rollback.** Rollback is `scripts/deploy-production.sh rollback` to the previous image, with the
   schema left in place. The old reader ignores the table. Judge whether the manual `.rollback`
   script is safe: it refuses while any grant row exists.

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- this plan;
- `MIGRATION_COMPATIBILITY_CONTEXT.json`;
- `database/migrations/20261127000001_pro_studio_grants.sql`;
- `database/migrations/20261127000001_pro_studio_grants_rollback.rollback`;
- `scripts/deploy-production.sh`;
- `scripts/run-sql-migrations.sh`;
- target `lib/proStudio/grant.ts`;
- target `app/pro-studio/page.tsx`;
- target `lib/house/entrance.ts`;
- target `lib/house/proRooms.ts`;
- target `app/house/page.tsx`;
- target `app/api/members/delete-account/route.ts`;
- target `docs/programme/PRO_STUDIO_GRANT_DESIGN_2026-11-27.md`;
- exact old-reader `app/pro-studio/page.tsx`;
- exact old-reader `lib/house/entrance.ts`;
- exact old-reader `app/api/members/delete-account/route.ts`.

Old-reader paths live beneath `old-reader/<exact-old-reader-SHA>/...` in the bundle. A search can
help find files, or show that none references the table, but a search does not count as coverage.

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

- **#2441:** merged by Kelly; its CI included "Empty database reconstruction".
- **#2449:** six new tests for Pro rooms. Four House suites fail, and they fail identically on
  unchanged canonical. `npm run typecheck` shows no regressions.
- No independent code review of #2441 or #2449 was performed before this one.

This review covers the migration act only.

## Closing condition

An admitted `APPROVED` review with `COMPATIBLE` and `ALL_PREFIXES_COMPATIBLE` licenses the
migrate-before-swap sequence above for this exact pending set and no other. It does not state that
the migration or the feature is correct.
