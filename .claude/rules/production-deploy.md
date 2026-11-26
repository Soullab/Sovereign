---
paths:
  - "scripts/deploy*.sh"
  - "scripts/pre-deploy-gate.sh"
  - "scripts/preflight*.sh"
  - "docker-compose*.yml"
  - "Dockerfile*"
  - "Caddyfile"
  - "docs/ops/**"
---

<!-- Moved verbatim from CLAUDE.md lines 101-161 (JARVIS-AIO-01 P2). Binding as CLAUDE.md. -->

### Production Stack (on minisforum)
All services run in Docker on **minisforum**:
- `maia-sovereign` — Main Next.js app (port 3000, Docker-internal only)
- `maia-api` — API backend (port 3001, published)
- `maia-caddy` — Reverse proxy (ports 80/443, published)
- `maia-postgres` — PostgreSQL database
- `maia-comms-worker` — Background worker
- `maia-whisper` — Speech processing
- `maia-rlm` — RLM service

### Mac Studio role
The Mac Studio (this machine, where Claude Code typically runs) hosts the active git worktrees and is the primary dev environment. It runs a parallel docker stack with the same container names and the same compose file, but **that stack is not in the public soullab.life traffic path**. A successful `docker compose up -d --build` on the Mac Studio updates the local stack only — production stays unchanged.

### Check Production Status
```bash
# Inspect the actual production container on minisforum (not the local stack):
ssh soullab@minisforum 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
ssh soullab@minisforum 'docker inspect maia-sovereign --format "{{.Created}} {{.Image}}"'

# External (hits the LAN public IP → router → minisforum):
curl -k https://soullab.life/api/health
```

### Production Deployment
- Host: **minisforum** (SSH from Mac Studio: `ssh soullab@minisforum`)
- Stack: Docker + Caddy
- Compose file: `docker-compose.production.yml`
- **Deploy lane lock (one deploy at a time — structural, not disciplinary)**: every deploy entry point (`deploy-production.sh deploy/update/migrate/rollback` and `pre-deploy-gate.sh deploy-maia`) takes an exclusive non-blocking `flock` on `/home/soullab/MAIA-SOVEREIGN/.deploy.lock` via `scripts/deploy-lock.sh`. A second deploy attempt is **refused** with the holder's PID / start time / entry point / **asserted target SHA** printed (`target_sha=`; the shared checkout's HEAD appears only as a labelled `checkout_head=` line when it differs — the record names what the deploy was asked to build, never the checkout). The kernel lock is inherited by the docker compose build and auto-releases when the whole deploy tree exits or dies — a crashed deploy cannot leave the lane locked. If a refusal shows a dead holder PID, a child of that deploy (usually the build) is still running: inspect with `fuser -v ~/MAIA-SOVEREIGN/.deploy.lock`. **Never delete the lockfile to force entry** — that detaches the kernel lock from future acquirers and re-opens the 2026-07-09 concurrent-deploy race (five processes wedged on the buildkit lock because parallel sessions' deploys could not see each other).
- **Deploy command — quick `maia`-only rebuild** (run from Mac Studio, executes on minisforum). Canonical quick path is the pre-deploy gate, which acquires the deploy-lane lock, **materializes an explicitly named immutable commit into an isolated build context** (never whatever branch is checked out — 2026-07-27 shared-checkout incident, `docs/ops/IMMUTABLE_SHA_DEPLOY.md`), runs the Co-Lab + disk gates, builds, refreshes rollback tags, swaps, then verifies the running container's `GIT_COMMIT` equals the named SHA. **`deploy-maia` now REQUIRES a SHA argument** — name the fetched remote tip so no `git checkout` of the shared working tree is needed:
  ⚠️ **Combined `deploy-maia` is RETIRED** (`DEPLOY-LANE-PREPARE-CUTOVER-SPLIT-01`, `scripts/pre-deploy-gate.sh`): it now refuses with `gate:BLOCK`. The quick path is two acts. **`prepare-maia <SHA>`** materializes the named commit, runs the Co-Lab, disk and migration gates, freezes the live image as the rollback baseline, and builds and freezes `maia-sovereign:candidate-<sha>`. It does **not** recreate production. **`cutover-maia <SHA>`** is a **separately authorized** act. It re-proves the candidate, live and rollback custody, swaps the container, and verifies provenance on both channels. Both refuse a SHA that does not descend from running production. Observed in use 2026-11-12 (`69638163f`).
  ```bash
  ssh soullab@minisforum 'cd ~/MAIA-SOVEREIGN \
    && git fetch origin clean-main-no-secrets \
    && scripts/pre-deploy-gate.sh prepare-maia "$(git rev-parse --short origin/clean-main-no-secrets)"'
  # then, only under its own authorization, with the SAME SHA:
  ssh soullab@minisforum 'cd ~/MAIA-SOVEREIGN && scripts/pre-deploy-gate.sh cutover-maia <SHA>'
  ```
  The SHA is snapshotted via `git archive`, so a concurrent session checking out a different branch cannot change the build (the deploy-lane flock serializes deploys but does NOT protect the checkout→lock interval — that gap is what the snapshot closes). No SHA + `DEPLOY_ALLOW_HEAD=1` builds the current checkout tip as an explicit ack (still snapshotted + announced). Fast, but rebuilds **only** the `maia` service — it does **not** run migrations or touch other services. It DOES refresh the rollback tags (`maia-sovereign:current`/`:previous`/`:<sha>` via shared `scripts/deploy-tag.sh`) before swapping the container.
  **The bare compose command (`GIT_COMMIT=... docker compose ... up -d --build maia`, with or without the prefix) is retired STRUCTURALLY — it now FAILS at build time.** The Dockerfile's deploy-lane tripwire (`docs/ops/DEPLOY_LANE_TOKEN.md`) refuses any build of `docker-compose.production.yml` that didn't come through `acquire_deploy_lock()` (which exports `DEPLOY_LANE_TOKEN`; the compose build-arg has deliberately no default). Why it was retired: (1) without the `GIT_COMMIT` prefix it baked `GIT_COMMIT=unknown` into the image; (2) it bypassed the deploy-lane lock, so it could race a deploy already in flight; (3) on 2026-07-10 it bypassed the pre-deploy gate and skipped rollback tagging, leaving `maia-sovereign:current` pointing at the wrong image. The failure is loud and safe — the build dies in under a second; the running container is untouched. Check which lane built the live container: `docker exec maia-sovereign printenv DEPLOY_LANE` (→ `deploy-lane`; pre-tripwire images lack the variable). Local dev (`docker-compose.yml`) and staging declare their own lane tokens in-file and are unaffected.
- **Full deploy — canonical path**: `scripts/deploy-production.sh deploy <SHA>`. The complete all-services deploy: it acquires the deploy-lane lock, **materializes the named immutable commit into an isolated build context** (same control as the quick path — `docs/ops/IMMUTABLE_SHA_DEPLOY.md`), exports `GIT_COMMIT` (from the asserted SHA) / `APP_VERSION` (read from the snapshot) / `BUILD_DATE`, builds with the provenance build-args from that snapshot, tags images per-commit for rollback, brings the stack up, verifies running provenance, and runs DB migrations (migrations execute from the snapshot too). `deploy` REQUIRES a SHA (or `DEPLOY_ALLOW_HEAD=1` ack); `update` pulls a branch then builds the pulled tip as an immutable snapshot. Use it for schema changes, multi-service changes, or whenever you want a rollback point — i.e. anything beyond a quick `maia`-only code rebuild. **Post-swap provenance verify is fail-closed on every path** (`deploy`, `update`, `deploy-maia`): if the running container does not report the authorized SHA, the deploy ABORTS before migrations/smoke and points at `rollback` — a mismatch never silently proceeds.
- **macOS dev-stack caveat (immutable-SHA build context)**: the deploy materializes the build context as a `git archive` snapshot under `$TMPDIR`, and the `migrate` service bind-mounts that snapshot's `database/migrations`. On **minisforum (Linux, production) this is transparent** — `/tmp` binds into containers freely. On the **Mac Studio parallel stack**, Docker Desktop must be able to share the snapshot path, or the migrate mount fails; if so, set `DEPLOY_CONTEXT_DIR=<a Docker-Desktop-shared path>` before deploying. Production is unaffected. Full detail + the `DEPLOY_CONTEXT_DIR` / `DEPLOY_ALLOW_HEAD` seams: `docs/ops/IMMUTABLE_SHA_DEPLOY.md`.
- **Verify after deploy**:
  ```bash
  # 1. Container freshness
  ssh soullab@minisforum 'docker inspect maia-sovereign --format "{{.Created}}"'

  # 2. LAN IP sanity (verify live DHCP lease, host identity and router forwarding; no fixed expected address)
  ssh soullab@minisforum 'hostname -I'

  # 3. Public reachability (external path through DNS + router forward)
  curl -k https://soullab.life/api/health

  # 4. Provenance — what commit is actually live (must be the SHA you deployed, NOT "unknown")
  ssh soullab@minisforum 'docker exec maia-sovereign printenv GIT_COMMIT'
  ```
  `Created` should show a recent timestamp only after a fresh container swap. `hostname -I` gives the current LAN address, which must be compared with the router's DHCP lease, :80/:443 forwarding destination and Caddy's LAN allowlist; a different address alone does not prove external reachability failed. Neither `192.168.0.104` nor the `192.168.4.38` observed on 2026-10-17 is a permanent rule. After a fresh swap, `/api/health` should return fresh JSON with `uptime` near zero. `printenv GIT_COMMIT` must return the authorized SHA deployed.

  **Diagnostic — `GIT_COMMIT=unknown` does NOT imply missing provenance wiring.** The chain is already complete: Dockerfile (`ENV GIT_COMMIT=${GIT_COMMIT}`) ← compose (`build.args.GIT_COMMIT`) ← deploy (`scripts/deploy-production.sh` exports it; the quick command must prefix it). `unknown` means the deploy route *bypassed* that chain — almost always the quick command run **without** the `GIT_COMMIT=$(git rev-parse --short HEAD)` prefix. So if you see `unknown`, first verify **which deploy path was used** before suspecting the build-arg wiring. **Second cause (2026-09-03): the image can be stamped while the container is not** — compare `docker image inspect maia-sovereign:current` against `docker inspect maia-sovereign` `Config.Env`; a runtime `environment: GIT_COMMIT` override in a stale checkout compose rewrites the image's identity at `up`. The repaired gate refuses that override and verifies both channels.
- CI deploys are disabled (self-hosted runner not yet configured).
- **Common deploy mistake**: rebuilding on the Mac Studio instead of minisforum. The local stack will report healthy and `Created` will update, but the public soullab.life traffic continues hitting minisforum's old container. Always verify with the minisforum-side `Created` check above, not just the local one.
