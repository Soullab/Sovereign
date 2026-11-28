# minisforum shared-checkout drift inventory — 2026-11-27

**Evidence class.** Read-only observation over SSH (`git status`, `git hash-object`, `sha256sum`, `docker inspect`). Blobs were compared against `origin/clean-main-no-secrets` at `a2317fb10`.

**Nothing on minisforum was changed.** This is an inventory, not a reconciliation. ⛔ It does not authorize moving the checkout.

## Context

- **Checkout:** `/home/soullab/MAIA-SOVEREIGN`, branch `clean-main-no-secrets`, committed HEAD `56d0cd679` (2026-10-01). There are 39 status entries.
- **Production:** runs `a2317fb10` (`DEPLOY_LANE=deploy-lane`, created 2026-11-27T21:33Z). `pro_studio_grants` exists.
- **Compose files:** `maia-sovereign` and `maia-caddy` were launched from deploy **snapshot** compose files (`/tmp/maia-deploy-ctx.*`), not the checkout's compose file.
- **Caddyfile:** `maia-caddy` **bind-mounts the checkout's `Caddyfile`**. The checkout file and `/etc/caddy/Caddyfile` in the container have the same sha256 (`1fd8ed48…`). The checkout's Caddyfile *is* live edge config, and it takes effect on the next reload or restart.

## Tracked files (9)

| File | State | vs main | Meaning |
|---|---|---|---|
| `Caddyfile` | modified | **diverged both ways** | Live edge config; see below |
| `docker-compose.production.yml` | modified | differs (1 line) | A healthcheck path changed from `/api/consciousness/health` to `/` (2026-10-21). Only checkout-compose paths, such as rollback, read this file. |
| `scripts/backup-postgres.sh` | modified | = main | Hand-applied copy of main |
| `scripts/deploy-context.sh` | modified | = main | Hand-applied 2026-11-25 |
| `scripts/deploy-tag.sh` | modified | = main | Hand-applied 2026-11-25; has the `:prod` guard |
| `scripts/pre-deploy-gate.sh` | staged | = main | Hand-applied 2026-11-01 |
| `scripts/deploy-production.sh` | staged | **an older main version** (the blob replaced by `e3a8b5968`) | Has no `prod_tag_guard_arm`/`disarm`. This is the cause of the 2026-11-27 `:prod` leftover (Soullab/Sovereign#2456). |
| `scripts/rollback-guards/d49dbc98….sql`, `….repair.sql` | staged (new) | = main | Already on main |

**Result:** 7 of 9 already equal main. One is stale (`deploy-production.sh`). Two hold content that exists only here (`Caddyfile`, compose healthcheck).

## Caddyfile divergence

- **Size:** live is 1,253 lines and main is 1,000. 423 diff lines in total: about 338 exist only in live, and 85 exist only on main.
- **`bb593e6c9`** ("contain exposed administrative read routes"): **all 39 added lines are present in live.** The containment is live.
- **`fb8e69c02`** (Studio doorways `writer.`/`sound.`/`guide.`/`astrology.soullab.life`): **9 of 31 lines are absent from live**, including the host block. Its own comment says the DNS A records must exist before deploy, or ACME requests fail and keep retrying.
- **Only in live:** the holds and gates added on minisforum and never committed. Examples:
  - `@source_write_pre_migration_hold`
  - `@beta_member_thresholds`
  - the writer export and ingest holds
  - the R7017, R7018 and R7025 admin and content-security edits; dated `.pre-*` backups exist for each.

**Consequence:** neither file is a superset of the other. Checking out main would drop the live-only holds and would switch on the doorway hosts at the next Caddy reload. Reconciling them is a merge that needs review.

## Untracked files (30)

- **Keep, deploy state or evidence:**
  - `.deploy-prepared-maia` (prepare record, 2026-11-27 18:36)
  - `.deploy-evidence/605f84fc4/{record,review,trace}` (a REVIEW-CUSTODY triplet from 2026-09-30)
  - `.reflect-founder-activation.lock`
- **Historical Caddy/compose backups (19):** `Caddyfile.pre-*`, `Caddyfile.PRE-*`, `*.candidate`, `Caddyfile.WITH-F4-DENIAL`, two `docker-compose.production.yml.*-bak`. These are the only record of when each live edge change was made. Archive them; don't delete them.
- **`beta/primary-writers-studio/{index,studio}.html`** (2026-10-18): static beta pages, possibly served. Check Caddy before treating them as junk.
- **Probably accidental shell redirects, all from 2026-07 to 2026-10.** They look like stray redirect output, but that is inferred from the names, not verified:
  - `" .Destination "` (0 B)
  - `"e -f docker-compose.staging.yml up -d --build"` (6 KB)
  - `spiralogic-oracle-system@1.2.0` (0 B)
  - `tsc` (0 B)

## Recommended reconciliation (each step needs its own go-ahead)

1. Save the full `git diff`, the staged diff and the untracked files somewhere outside the checkout.
2. Open a PR that brings the live-only Caddyfile content and the compose healthcheck onto main. Handle the doorway block in that PR, gated on DNS.
3. After it merges, move the checkout to main. Check that the live file's sha256 equals the merged Caddyfile **before** any Caddy reload.
4. Structural follow-up: make the deploy scripts run from the target snapshot, or refuse when governed paths drift from it. The edge config should not be live from an uncommitted working tree.
