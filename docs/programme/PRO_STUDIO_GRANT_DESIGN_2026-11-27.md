# Pro Studio grant — design record (HOUSE-ENTRANCE-01 §9)

**Status:** MERGED (#2441). The migration is under independent review for production (2026-11-27) and is applied to production only by an admitted review and the full deploy; check the production ledger for whether it has run. Issuing grants still has no surface, and retention and erasure of grant rows await a founder ruling.
**Governing:** `HOUSE-ENTRANCE-01_LEARN_AND_TRY_PAGE_DESIGN_2026-10-30.md` §9 · founder ruling 2026-10-30 (four canon paths; `tier` is not the entitlement) · founder ruling 2026-11-27 ("founder now, grant next").

## What it is

`pro_studio_grants` is the only source that may make `proStudioEntitlement` `'verified'`. A member whose grant is current is sent from `/pro-studio` straight to `/studio`. Everyone else gets the learn-and-try introduction.

| Requirement (§9) | How it is held |
|---|---|
| path: paid · scholarship · exchange · apprenticeship | `path` CHECK names exactly these four. The reader refuses any other value it reads. |
| current | Worked out when it is read, against the database clock: not revoked, `starts_at <= now()`, and `expires_at` either null or later than now. Never stored, so it cannot go stale. |
| revocable | `revoked_at` and `revoked_by_member_id` are set together (CHECK). Every grant can be revoked; the schema allows no other kind. |
| who granted | `granted_by_member_id` NOT NULL, a foreign key to `members`, and it may not be the grantee (CHECK). |
| not derived from `members.tier` | Neither the table nor the reader mentions tier, subscription or practitioner fields (static tests). |
| confers no client-data or Co-Lab permission | The table is referenced by nothing. The reader is imported only by `app/pro-studio/page.tsx` and, since #2449, by `lib/house/proRooms.ts`, which uses it only to show a Home link to `/pro-studio`. A static test pins exactly those two importers, and `/studio` keeps its own guards. |

**Custody.** Rows are append-only. A DELETE trigger refuses every delete. An UPDATE trigger allows only one change: a single revocation. Granting again means a new row, so the history stays readable. The rollback refuses to run while any row exists.

**Failure.** If the table can't be read (not migrated yet, database down), the result is `unreadable`, which is distinct from `no_grant`. It is logged with the table named (per `docs/ops/DB_MISSING_TABLE_DEGRADATION_AUDIT_2026-08-01.md`), and the entitlement stays `'absent'`. Because it fails closed, code that ships before the migration is safe.

## Not decided here (founder / stewardship)

1. **Who may issue a grant, and through what surface.** No write path is built. Until one exists, a grant can only be issued by a deliberate, attributable SQL insert under founder authority.
2. **Paid grants from Stripe.** A webhook-issued grant has no human steward. Allowing a system grantor needs a further migration, plus a ruling on whether a system may grant at all.
3. **Seat-cap accounting** (20–30% supported seats) for scholarship and exchange grants: §9 says the free learn-and-try path does not count, but this record says nothing about how grants count.
4. **Composition with the founder door** (`feature/pro-studio-founder-door`, PR #2440). This work is built on top of it. The founder allowlist (`founderAccess`) and a current grant (`proStudioEntitlement: 'verified'`) are separate facts; either one resolves to `full_workspace`. `?view=intro` works for anyone with the full studio.

## Evidence

- Migration applied twice in a scratch database (idempotent). Refused as designed: a non-canon path, a self-grant, an inverted window, a fact change, a delete, a half-revocation and a second revocation. Rollback refuses while rows exist and runs clean on an empty table.
- Reader SQL run against fixtures: current → found; revoked, expired, future-start and no grant → not found.
- Jest: `lib/proStudio/__tests__/grant.test.ts`, `app/pro-studio/__tests__/page.test.ts`.
- ⛔ No production, staging or member database was touched. There is no runtime or member witness yet.
