# JARVIS-AIO-01 · PR #2426 governance discrepancy — evidence packet for founder disposition (26 Nov 2026)

**Lane:** JARVIS-AIO-01 (#1974). **Standing: EVIDENCE + PROPOSED.** Founder direction (26 Nov):
- preserve the evidence;
- present the exact merged diff, the governance-recall results and any missing safeguards for explicit disposition;
- do not infer authorization from the shared GitHub account;
- do not revert, and do not retrospectively ratify.

This packet does none of those acts. The merge stays exactly as it is until Kelly disposes of it.
**Item state:** `RULING_REQUIRED`.

## 1. Exact merged diff (custody-verified 26 Nov)

| Field | Value |
|---|---|
| Merge commit | `47b9a765987ca11f29653aa89a4abbfca4958bf0`, author "Kelly Nezat", committer GitHub (a GitHub-side merge) |
| Parents | base `82569ccb933e6397088313cfecba9c1896335512` · head `9a7c2447df172a7918d61c9afe79418db40c50b4` (single commit "docs(claude): lean session anchor with path-scoped rule packets (JARVIS-AIO-01 P2)") |
| Diff | `git diff 82569ccb93 47b9a76598`; sha256 of the diff text: `6638715486a20a7c96c0ffd422529514f89c5774e8f3b050ab6bdf86267d1421` |
| Files | `CLAUDE.md` +8 / −196 (474 → 286 lines) · new `.claude/rules/production-deploy.md` (73) · `.claude/rules/onboarding-members.md` (98) · `.claude/rules/bridge-d-spiral-state.md` (62) |
| On main | Yes, an ancestor of `origin/clean-main-no-secrets` (`448f66e92`) |

Kelly can review the exact text with this command:

```bash
git -C /Users/soullab/MAIA-SOVEREIGN diff 82569ccb933e6397088313cfecba9c1896335512 47b9a765987ca11f29653aa89a4abbfca4958bf0
```

**Record correction (DISCOVERED):** comment 7205297638 says #2426 removed "the duplicate context-mode block". At
both the base and the merge, `CLAUDE.md` contains the `context-mode — MANDATORY` block **exactly once**. #2426 did not
remove it; open PR #2428 proposes removing it. The comment's other line ("#2428 removes the context-mode block that
#2426 left in place") is the accurate one.

## 2. Governance-recall and preservation results (as posted on the PR; not re-run here)

- **A2 recall witness** (PR comment, 16:10:17Z): 17 binding-rule questions with fixed answer keys, `claude -p --model
  sonnet` v2.1.314, Read/Glob/Grep only. Baseline 17/17 ($0.107) and lean 17/17 ($0.117). The lean run read the three
  packets.
  - Limits: one run per side, one model, Haiku workers not probed.
  - It ran before spend approval #1 was recorded and is outside the $40 accounting.
- **Preservation claim** (PR body): all 311 non-blank lines of the old CLAUDE.md, excluding the context-mode block,
  appear exactly once in the new files, as contiguous verbatim slices. *This packet has not independently re-verified
  it.* Re-verification is a read-only script and can be done on request.
- **Not witnessed** (PR body): a model reading a packet from the index when no file triggers it; ≥ 15-probe recall
  under AIO A2 as specified.
- **Adjacent defects the PR noted, not touched:** `scripts/verify-bridge-d-db.sql` and `app/intro-maia`,
  `app/intro-daimon` do not exist. Hosts without `~/CLAUDE.md` (e.g. minisforum) lose the context-mode rules.
- **Required checks:** all passed on head `9a7c2447`: `covenant-gates` 16:08:37Z, `Axis 1` 16:09:57Z, `sovereignty`
  16:10:58Z, `check-diagrams` 16:11:08Z, `build` 16:17:01Z.

## 3. What happened (timeline, from the GitHub API)

| UTC (26 Nov) | Event | Actor |
|---|---|---|
| 16:08:28 | PR opened. Body: "**Needs founder approval of this exact diff** (governing-instruction change). Do not auto-merge." | `Soullab` |
| 16:10:17 | Recall-witness comment | `Soullab` |
| 16:11:15 | **`auto_merge_enabled`** | `Soullab` |
| 16:17:01 | Last required check (`build`) passed | CI |
| 16:17:07 | Merged by auto-merge | `Soullab` (auto-merge on the enabler's behalf) |
| 23:09–23:16 | Lane record grants approval #2 as "built in a worktree for founder review … **Not merged**", then a correction notes the merge and says its approval is "not established here" | `Soullab` |

0 reviews, empty review decision. **Who enabled auto-merge, and under what ruling, is UNKNOWN.** The `Soullab` login is
used by both the founder and Claude sessions through `gh`, so it attributes the act to no particular person.

## 4. Missing safeguards (read-only observation of current settings; nothing changed)

| # | Safeguard | Current state | Effect in this case |
|---|---|---|---|
| S-1 | Distinguishable human vs agent identity | One `Soullab` account (admin) used by founder and agents. A second account `SoullabCovenant` (write) exists; its holder and use are UNKNOWN | Approval cannot be attributed |
| S-2 | Required human approval on governing-instruction paths | Branch protection `required_approving_review_count: 0`, `require_code_owner_reviews: false` | Nothing required a review |
| S-3 | CODEOWNERS for governing instructions | `CODEOWNERS` exists (Class A paths → `@Soullab`) but has no entries for `CLAUDE.md`, `.claude/**`, `docs/canon/**` or `docs/programme/JARVIS_*`, and it is not enforced (S-2) | Even an enforced CODEOWNERS would not have covered this diff |
| S-4 | Auto-merge allowed on the repo | `allow_auto_merge: true` | A "do not auto-merge" instruction in a PR body is text, not a control |
| S-5 | Gate that reads a PR's own approval requirement | None: `covenant-gates` passed although the body declared a founder-approval requirement | The constitutional check did not see the requirement |
| S-6 | Admin enforcement | `enforce_admins: true` (present, good). It does not help, because the required review count is 0 | — |

Observation, not verified as a change: `covenant-gates` is now among the **five** required checks. The ACCEPT-01 record
(26 Nov, earlier) listed four required checks, with covenant-gates advisory, and AIO-01 approval #5 is recorded as
pending. When and by whom it became required is **not established here**; it is reported for reconciliation only.

## 5. Dispositions available to Kelly (no recommendation is made for the merge itself; it is the founder's call)

1. **Ratify after review.** Kelly reviews the diff in §1 and records explicit acceptance on #1974, citing the merge SHA.
2. **Revert.** A revert PR of `47b9a765` is prepared for Kelly's review. That PR is itself a governing-instruction
   change, and #2428 would need rebasing.
3. **Hold as-is, pending.** The merge stays, marked `RULING_REQUIRED` on #1974. Further P2 slices (#2428) wait.
4. **Partial.** Keep some packets and revert others, through a new reviewed PR.

Whichever disposition is chosen, the record should state that the original merge was **not** founder-approved before it
merged, on the evidence available.

## 6. Proposal — distinguishable identities and enforceable approval boundaries (`PROPOSED`; each item needs its own approval)

| # | Proposal | Enforced by | Closes |
|---|---|---|---|
| G-1 | A **separate GitHub identity for agents**: a machine user or GitHub App, e.g. `soullab-jarvis[bot]`, with `write` only and no admin. Agents' `gh` uses only its token. The founder's `Soullab` login is never configured in an agent session | GitHub account boundary | S-1: every act becomes attributable |
| G-2 | **Branch protection: 1 required approving review** from a human account, `require_code_owner_reviews: true`, `require_last_push_approval: true` | GitHub | S-2: an agent cannot approve its own PR, since the author cannot approve |
| G-3 | **CODEOWNERS** entries: `/CLAUDE.md`, `/.claude/**`, `/docs/canon/**`, `/docs/governance/**`, `/docs/programme/JARVIS_*` → the founder's human account | GitHub | S-3 |
| G-4 | **Auto-merge off** for governed paths: either `allow_auto_merge: false` repo-wide, or rely on G-2, which blocks auto-merge until a human approves | GitHub | S-4 |
| G-5 | `covenant-gates` reads a PR label or body marker (`needs-founder-approval`) and **fails** until an approving review from the founder account exists | CI (required check) | S-5 |
| G-6 | Agent sessions record the acting identity (`gh api user`) in every owner-record comment they post | Convention plus G-1 | Record attribution |

**Order proposed:** G-1 → G-2/G-3 together → G-4 → G-5.
- G-1 first, because G-2 means nothing while human and agent share one login.
- G-2 has a cost: the founder must approve every PR, including docs. Path-scoping it via G-3 limits that cost to governed
  paths if Kelly wants it.

These items are branch-protection and account changes: protected acts that Kelly performs or explicitly authorizes. They
overlap AIO-01 approval #5 (`covenant-gates` required check) and should be decided together with it. They do not create
a new release process; they make the existing approval requirement enforceable.
