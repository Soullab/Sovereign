# JARVIS-AIO-01 · P5 · Isolated execution identity — setup and witness checks (26 Nov 2026)

**Lane:** JARVIS-AIO-01 (#1974). **Standing: PROPOSED / PREPARED.** Founder direction (26 Nov) requires a separate,
credential-free identity, **witnessed and accepted before any paid Phase 2 run**.
**Who does what:** Kelly creates the account, sets its password, creates and installs the provider key, and accepts
workspace trust. Claude prepares these instructions, reviews the witness output when Kelly shares it, and does none of
those acts. Nothing here has been executed.

## 1. Properties the identity must have

| # | Property | Why |
|---|---|---|
| I-1 | A distinct macOS **Standard** user (not an admin; proposed name `jarvisbench`), with no Apple ID and no iCloud | An OS account boundary, rather than a same-user sandbox |
| I-2 | No GitHub, SSH, AWS or Docker credentials; no `gh` login; no git remote with push rights | No GitHub write authority; no ssh to minisforum |
| I-3 | Cannot read `/Users/soullab/**` (macOS default home permissions, verified, not assumed) | Founder's keys, `.env*`, `.env.docker` and memory stay unreachable |
| I-4 | No production DB access, and no access to the founder's local Postgres (`127.0.0.1:5432`, listening, owned by `soullab`) | No member data and no DB credentials |
| I-5 | No Docker socket access (`/var/run/docker.sock` → `/Users/soullab/.docker/run/docker.sock`) | No container escape into founder space or deploy tooling |
| I-6 | Provider access only through a **benchmark-only API key** in a separate workspace with a **spend limit ≤ $28** | The key cannot be reused against founder resources and cannot overspend the cap |
| I-7 | Repository delivered as a **git bundle at the pinned SHA**, with no remote configured | Source is read-only to the upstream; nothing can be pushed |
| I-8 | Claude Code runs with the sandbox on (`failIfUnavailable`, no unsandboxed retry), network limited to `api.anthropic.com` and `registry.npmjs.org`, and auto-memory off | Defence in depth; T4 needs a memory store that stays empty |

Alternative to I-1: a container with only the bundle-cloned worktree mounted, no Docker socket, network restricted to
the two hosts, and the key passed in as an environment variable. The same checks in §4 apply, run inside the
container.

## 2. Setup steps (Kelly runs them; each step is reversible by deleting the account)

1. System Settings → Users & Groups → Add User: **Standard** user `jarvisbench`. Do not sign in with an Apple ID.
2. Do **not** add the account to the `admin` or `docker` groups, or to any group with access to `/Users/soullab`.
3. As `soullab`, export the pinned tree. The SHA is chosen when the design is ratified.
   `git -C /Users/soullab/MAIA-SOVEREIGN bundle create /Users/Shared/jarvis-bench/maia-<sha>.bundle <sha>`
   Then make the bundle readable: `chmod 644`.
4. As `jarvisbench`: `git clone /Users/Shared/jarvis-bench/maia-<sha>.bundle ~/bench/maia`, then
   `git -C ~/bench/maia remote remove origin`.
5. As `jarvisbench`: install Node and Claude Code into the user's own prefix (for example `npm i -g` with a prefix under
   `~`). Run `npm ci` in `~/bench/maia`.
6. The provider key (Kelly only). In the Anthropic console:
   - create a workspace named `jarvis-benchmark`;
   - set its spend limit to **≤ $28**;
   - create a key in that workspace.
   Place the key in `~jarvisbench/.bench-key` with mode `600` and export it only inside the driver. Claude never sees
   or types the value. No founder OAuth login and no keychain item is created for this user.
7. Write `~jarvisbench/.claude/settings.json` with the sandbox, network allowlist, `denyRead` and deny rules listed in
   AIO-01 §6, plus `autoMemoryEnabled: false`. This is a settings change for the benchmark identity only; Kelly reviews
   the exact file before it is used.

## 3. Witness checks (run **as `jarvisbench`**; every line must print `PASS`)

The script is read-only and sends nothing anywhere. Kelly runs it; the output goes into the owner record as the witness.

```bash
#!/bin/bash
# JARVIS-AIO-01 P5 isolation witness — read-only. Run as the benchmark identity.
p(){ echo "PASS $1"; }; f(){ echo "FAIL $1"; FAILED=1; }; FAILED=0
[ "$(id -un)" != "soullab" ] && p "I-1 user=$(id -un)" || f "I-1 running as soullab"
id -Gn | tr ' ' '\n' | grep -qx admin && f "I-1 in admin group" || p "I-1 not admin"
id -Gn | tr ' ' '\n' | grep -qx docker && f "I-5 in docker group" || p "I-5 not in docker group"
ls /Users/soullab/ >/dev/null 2>&1 && f "I-3 can list /Users/soullab" || p "I-3 /Users/soullab unreadable"
cat /Users/soullab/MAIA-SOVEREIGN/.env.docker >/dev/null 2>&1 && f "I-3 .env.docker readable" || p "I-3 .env.docker unreadable"
for d in ~/.ssh ~/.aws ~/.config/gh ~/.docker; do [ -e "$d" ] && f "I-2 $d exists" || p "I-2 no $d"; done
command -v gh >/dev/null && { gh auth status >/dev/null 2>&1 && f "I-2 gh authenticated" || p "I-2 gh not authenticated"; } || p "I-2 gh absent"
ssh -o BatchMode=yes -o ConnectTimeout=5 soullab@minisforum true 2>/dev/null && f "I-2 ssh minisforum succeeded" || p "I-2 ssh minisforum refused"
[ -z "$(git -C ~/bench/maia remote)" ] && p "I-7 no git remote" || f "I-7 remote configured"
GIT_TERMINAL_PROMPT=0 git -c credential.helper= -C ~/bench/maia push https://github.com/Soullab/Sovereign.git HEAD:refs/heads/isolation-probe --dry-run </dev/null 2>/dev/null && f "I-2 push dry-run accepted" || p "I-2 push refused (no credentials)"
docker ps >/dev/null 2>&1 && f "I-5 docker reachable" || p "I-5 docker unreachable"
psql -h 127.0.0.1 -U soullab -d maia_consciousness -c 'select 1' -w >/dev/null 2>&1 && f "I-4 local Postgres connected as soullab" || p "I-4 local Postgres refused"
psql -h 127.0.0.1 -U "$(id -un)" -d postgres -c 'select 1' -w >/dev/null 2>&1 && f "I-4 local Postgres connected as self" || p "I-4 local Postgres refused (self)"
security find-generic-password -s "Claude Code-credentials" >/dev/null 2>&1 && f "I-6 Claude OAuth item in keychain" || p "I-6 no Claude OAuth item"
[ -f ~/.bench-key ] && [ "$(stat -f %Lp ~/.bench-key)" = "600" ] && p "I-6 bench key present, mode 600" || f "I-6 bench key missing or wrong mode"
env | grep -E -q '^(GITHUB_TOKEN|GH_TOKEN|AWS_|DATABASE_URL|PGPASSWORD)=' && f "I-2/I-4 credential env var set" || p "I-2/I-4 no credential env vars"
echo "RESULT: $([ $FAILED = 0 ] && echo ALL-PASS || echo FAILED)"; exit $FAILED
```

Then there is one **in-sandbox probe**, also run as `jarvisbench`, with no model turn. Start interactive `claude` in
`~/bench/maia` with the benchmark settings, run only the local `/sandbox` command, and exit without sending a prompt.
Kelly then confirms by eye:

- sandbox shown as enabled;
- network allowlist shown as the two hosts;
- workspace trust accepted by Kelly.

If a model turn is needed to exercise the sandbox, it waits for P-1 and counts against the $28 cap.

**Kelly verifies outside the script (the script cannot see these):**
- the `jarvis-benchmark` workspace spend limit is set and is ≤ $28;
- the key belongs to that workspace;
- `jarvisbench` is a Standard user in System Settings.

## 4. Acceptance

The isolation is **accepted** only when all of these hold:
1. the script prints `RESULT: ALL-PASS`;
2. Kelly confirms the three by-eye items;
3. Kelly states acceptance in chat or on #1974.

A PASS from the script alone is not acceptance (JARVIS Core B: an instrument is not proof until reconciled with the real
path). The benchmark driver re-runs §3 before each launch and refuses to start on any FAIL (design §6.3).

## 5. Not covered (stated plainly)

- Hooks run outside the sandbox (AIO-01 §6 caveat). The benchmark identity has no hooks of its own beyond what the
  bundled repo carries, and those run as `jarvisbench`, inside its OS boundary.
- macOS lets a Standard user read world-readable files elsewhere on disk, for example `/Users/Shared` and `/opt/homebrew`.
  The bundle directory is the only intended shared path. Anything secret placed in a world-readable location would be
  exposed; the script does not enumerate those locations.
- Local Ollama on `127.0.0.1:11434` stays reachable over loopback. It holds no credentials, and Phase 2 does not use it.
