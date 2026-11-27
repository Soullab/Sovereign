# ASTRO-PRO-KEEP Phase 2 deploy · Production witness (2026-11-23)

```
DEPLOYED:   a01418aae7e62565e8fb0ed38d2481b349251249 (canonical clean-main-no-secrets; PR #2386 merge)
OLD READER: 1c70c3c6f637eed2cc28007d35e5c9a34da8c7fd
PLAN:       docs/programme/ASTRO-PRO-KEEP_PHASE2_DEPLOY_MIGRATION_REVIEW_PLAN_R4_2026-11-23.md
            SHA-256 131a265455c4d31721365a479d5dcccbaade76e8e002f4c1eb2a3b0d728ced75
STANDING:   deployed and verified by its operator; not yet walked on a device.
```

## 0. Authorization and what shipped

Kelly, in session, approved the deploy in steps:
- "Yes, deploy after review";
- "cleared" for the Writer's Studio changes in the candidate;
- "go" for this exact commit, after being shown the release table.

What shipped, as first-parent merges since `1c70c3c6f`:

| Merge | PR | Independent review |
|---|---|---|
| `5f585217d` | #1741 P6 return-authority repair (Class A) | only as it bears on `keepSource`, in this plan |
| `a3c1969eb` | #2379 Pro Astrology Phase 2 | yes, R4 (below) |
| `f0cae2cf1` | #2381 review plan 1 | docs |
| `3d6e310d9` | #2380 Writer's Studio passage conversation | **none recorded**; shipped on the founder's "cleared" |
| `f3cfccdf9` | #2382 Phase 2 review fixes | yes, R4 |
| `a74e83552` | #2383 Writer's Studio "Keep my words" | **none recorded**; shipped on the founder's "cleared" |
| `145332573` | #2384 review plan R3 | docs |
| `5643b526f` | #2385 Writer's Studio passage corrections (Class A) | **none recorded**; shipped on the founder's "cleared" |
| `a01418aae` | #2386 review plan R4 | docs |

At the time of the GO, release ledger #1938 had no clearance entry for #2380, #2383 or #2385, and
none of the three had a submitted GitHub review.

## 1. Review custody

Four bounded reviews were run. Each reviewer was a separate `claude -p` process with
`--tools Read,Grep,Glob`, `--strict-mcp-config` and model `claude-fable-5-2`, run in the bundle root,
with its stream captured as the trace.

| Plan | Target | Verdict | Disposition |
|---|---|---|---|
| plan 1 | `f0cae2cf1` | REVISE | F1 (high: unbound `subjectKey`) and F2 fixed in #2382 |
| R2 | `f3cfccdf9` | APPROVED | not admitted (`MATERIAL_UNDER_APPROVED`, R2-F1 medium); plan corrected |
| R3 | `145332573` | REVISE | R3-F1 medium; S2 control added |
| **R4** | **`a01418aae`** | **APPROVED** | **admitted** |

Every review found the migration COMPATIBLE and ALL_PREFIXES_COMPATIBLE.

The R4 review:
- found high 0 · medium 0 · low 6;
- read 28 files, coverage witnessed;
- has review SHA-256 `e4aef784feda3abf10d48dcd071029ed8a846ed9fcab479d946bc2281f9d29bb`;
- was bound to `a01418aae` and admitted by `scripts/review-custody.ts admit` with `--repo-root` set to
  the bundle root.

Evidence (record, review, trace, prompt, schema, session id):
- Mac Studio: `~/rc-evidence-astro-p2`, `-r2`, `-r3`, `-r4`;
- minisforum: `~/review-custody-a01418a/`.

## 2. Deploy

The deploy ran on minisforum as `scripts/deploy-production.sh deploy a01418aae…`, with
`REVIEW_CUSTODY_RECORD/REVIEW/TRACE` set. The log is
`~/review-custody-a01418a/deploy-20261123T190317Z.log`, captured from its first line. It exited 0.

The log shows these steps, in order:
1. The image provenance was verified (`a01418aae`).
2. REVIEW-CUSTODY + MIGRATION-COMPATIBILITY applied, with 1 pending file, witnessed.
3. The old reader `1c70c3c6f` was re-witnessed immediately before migration.
4. `20261123000001_astro_pro_keep_phase2.sql` was applied before the candidate swap.
5. The running provenance check passed: `GIT_COMMIT=a01418aae` on both the printenv and Config.Env
   channels.
6. All smoke tests passed, including the constitutional verification (Co-Lab, Memory, Relationships,
   Development, MAIA).
7. The alert e-mail failed (`alert_smtp_not_configured`). This is known and non-critical.

**Deploy-script custody note.** The shared checkout on minisforum is at `56d0cd679`. It has staged
changes in `scripts/deploy-production.sh` and `scripts/pre-deploy-gate.sh`, plus local edits to
`Caddyfile`, `docker-compose.production.yml` and `scripts/backup-postgres.sh`. These are not this
lane's and were left untouched.

The checkout's `deploy-production.sh`, `deploy-context.sh` and `deploy-tag.sh` are the versions from
between 2026-11-01 and 2026-11-11. They predate `e3a8b5968` (the `:prod` restore on a pre-swap
refusal) and `e0f80b8f7` (the College Essay exception). They are the same scripts that ran the
morning deploy of `1c70c3c6f`, and they perform the reviewed order. The deploy used the snapshot's
compose file, which is byte-identical between `1c70c3c6f` and `a01418aae`. The live `Caddyfile` is
bind-mounted from the checkout and was not changed. **Follow-up for the deploy-lane owner:** bring
the checkout's deploy helpers to canonical, and dispose of its staged and local edits.

## 3. Operator stop conditions (plan R4)

- **S1** (before the deploy): `astro_pro_threads` held **0** rows at 18:58:12Z, and again **0** at
  19:03:10Z, immediately before the deploy started.
- **S2** (after the swap): the new `maia-sovereign` started at 2026-11-23T19:10:43.707Z. At 19:11:59Z:
  - threads opened before the start: **0**;
  - total threads: **0**;
  - `astro_pro_exchange` atoms whose `provenance.thread_id` does not resolve to a thread opened at or
    after the start: **0** (the reviewer's optional strengthening).

These were counts only. No member content was read.

## 4. After the deploy

- `astro_pro_turns.id` exists; the `source_type` CHECK admits `astro_pro_exchange`; the ledger
  records `20261123000001_astro_pro_keep_phase2.sql`.
- Containers `maia-sovereign` and `maia-api` are healthy. `maia-caddy` was not recreated (up 30 h).
- `https://soullab.life/api/health` returns 200 with `"version":"a01418aae"`, database ok and uptime
  66 s. This was checked through Caddy and through the public name from the server itself (LAN
  hairpin). It was **not** checked from an outside network.

## 5. Owed

- **Device walk.** Own chart: carry → main MAIA recognises it → archive → it no longer surfaces.
  Client chart: natal then transits on one client, while a second client sees nothing.
- **R1B.** Production has 143 atoms, 2 of them `member_pulled`; those are the candidates for the
  historical return-authority repair, now that R1A (#1741) is live.
- **Writer's Studio.** Independent review of #2380, #2383 and #2385, recorded in #1938, now that
  they are live.
- **R4 low findings.**
  - S2 cannot see a thread that is carried from and then deleted inside the window.
  - The old loader renders a carried atom as the member's question only, after a rollback.
  - There is no rollback guard for `1c70c3c6f`.
  - The carry refusal is not exercised against a real database.
  - The empty-`other` key edge case.
  - The design doc says "backfilled".
