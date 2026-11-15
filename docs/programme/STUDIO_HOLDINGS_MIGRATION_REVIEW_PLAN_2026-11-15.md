# Deploy 2026-11-15: review plan for the exact one pending migration (studio holdings)

**Date:** 2026-11-15
**Status:** BOUNDED INDEPENDENT REVIEW PLAN. NO DEPLOYMENT AUTHORITY BY ITSELF.

**Live old reader:** supplied by the harness through `MIGRATION_COMPATIBILITY_CONTEXT.json`. The reviewer establishes it
from the bundle, and the deploy lane re-witnesses it before mutation.

**Founder authorization (Kelly, 2026-11-15, in session; ledger #1938):**
- "Yes, merge #2283": the College Essay release reconcile, now in main.
- "Yes, review and include": deploy main, including #2250's holdings migration.

Also in the target: #2290 (questions-only Works get no wording in any channel), #2289 (Sound Studio tone lab) and
#2287 (Astrology Pro help flag). Those three are code only.

## Exact target relation

The target is the canonical merge commit of the PR that adds this plan. It must differ from its own first parent only
by this documentation file, and that first parent must add no migration beyond the one below. The reviewer
establishes the relation from immutable git bytes where it can, and otherwise says so.

## Exact production-pending set

1. `database/migrations/20261112000001_studio_holding_events.sql`
   sha256 `d676d21815b1ce44325c460899bb92c9305b216cb48478b7f5625c2be5dd2d2b`

It has a sibling `_rollback.rollback`. The file carries its own `BEGIN … COMMIT` with `SET LOCAL lock_timeout = '5s'` first.

Its filename sorts **before** migrations already applied (`20261113…`). The reviewer confirms from
`scripts/run-sql-migrations.sh` that pending files are chosen by absence from the ledger, not by position after the
newest applied file, so this one will be applied.

## What the migration does

It creates `studio_holding_events`, an append-only log of Studio product holdings:
- FK `members(id)` ON DELETE CASCADE;
- CHECKs on `product`, `event`, `source` and `actor`;
- `stripe_event_id` UNIQUE;
- an index on `(member_id, product, id DESC)`;
- a BEFORE UPDATE OR DELETE guard trigger that refuses UPDATE, and refuses DELETE while the member exists;
- a BEFORE TRUNCATE refusal.

It changes no existing table.

## Production facts supplied to the reviewer

Read-only, 2026-11-15, under `BEGIN READ ONLY`. Counts and schema only.
- **Live:** `ceb845be0`, now an ancestor of main.
- **Database:** PostgreSQL 16.13. The ledger's newest applied migration is `20261113000010_…`. `20261112000001` is not
  recorded.
- **The table and its functions** do not exist. `members` has 96 rows.
- **`STUDIO_HOLDINGS_ENABLED`** is unset in the running container and absent from `.env.production`.

## Independent review questions

1. **Additive.** Confirm the migration creates only new objects and touches no existing table or data.
2. **Out-of-order filename.** Confirm the runner will apply it, and that applying it after later-named migrations is
   harmless.
3. **Old reader's member deletion.** Judge whether the exact old reader's `DELETE FROM members`
   (`app/api/members/delete-account/route.ts`) still succeeds for a member with rows here. In particular, does the
   guard ("refuses DELETE while the member row still exists") permit the ON DELETE CASCADE removal? The table is
   empty between migration and swap.
4. **Dark by default.** In the target, confirm:
   - the only reader (`lib/auth/studioHoldings.ts`, used by `lib/auth/wholeWorkEntitlement.ts`) reads nothing unless
     `STUDIO_HOLDINGS_ENABLED === 'true'`;
   - nothing in the target writes this table;
   - with the switch off, every entitlement decision is unchanged.
5. **Prefix compatibility.** The single prefix 1 is compatible with the exact old reader still being live.
6. **Rollback.** Image rollback is to `ceb845be0`, and the schema stays. The old reader never references this table.
   Judge the rollback file.

A verdict of `REVISE` or `BLOCKED` is lawful and must never be converted into approval.

## Minimum physical Reads

- This plan, and `MIGRATION_COMPATIBILITY_CONTEXT.json`.
- The migration above.
- `scripts/deploy-production.sh` and `scripts/run-sql-migrations.sh`.
- Target files: `lib/auth/studioHoldings.ts`, `lib/auth/wholeWorkEntitlement.ts` and
  `app/api/members/delete-account/route.ts`.
- Exact old-reader files: `app/api/members/delete-account/route.ts` and `lib/auth/wholeWorkEntitlement.ts`.

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
