# Journey ledger (slice 1)

An executed member-journey harness for Writer's Studio. A scripted persona walks the real product in a real browser, and
every step ends in exactly one of three states:

| Status | Meaning |
| --- | --- |
| **PASS** | It was exercised and what it led to was rendered (page with real text, dialog, changed state, successful request). The row quotes the evidence. |
| **DEAD END** | It was exercised and led nowhere: blank page, 4xx/5xx, dead link, bounce to sign-in, a click nothing could receive, or nothing happened. |
| **NOT RUN** | It was not exercised, or could not be decided: the walk stopped, the control needed a MAIA reply (this slice has no MAIA step), it points off the product, the harness could not press it. |

**The rule, enforced in code** (`lib/ledger.mjs`, the one function `decide`): a journey "works" and the process exits 0 only
if it has at least one row and **every** row is PASS. Any DEAD END or NOT RUN row, or an empty ledger, exits 1 and the report
says `VERDICT: does NOT work`. Every planned row starts NOT RUN, so a crash, a timeout or a script that forgets a row cannot
produce a green report. Unobservable is not pass.

Why this exists: defects have been reaching the founder when they *use* the product, and earlier review read code. This
instrument presses the doors.

## Run it

```bash
bash tests/e2e/journey-ledger/run.sh --report /path/to/ledger.md
```

Needs: a checkout with `node_modules` (a symlink works), PostgreSQL 16 server binaries under `/usr/lib/postgresql/*/bin`,
Node 22, a Chromium that Playwright can drive (`JL_CHROMIUM=/path` to point at one; otherwise Playwright's own, then
`/opt/pw-browsers`), about 3 GB free disk for the `next dev` cache, and the ports below free (it refuses if they are not).
Running as root works (the database server then runs as the `postgres` user; Chromium gets `--no-sandbox`).

Flags: `--persona p1` (default) · `--defeat MODE` (run the committed WJ-1 spec with one of its four defeat modes on this stack; a NON-ZERO exit is the expected result) · `--wj1-only` (WJ-1 on this stack, no ledger walk) · `--hold` (bring the stack up and wait; harness development only) · `--flag K=V` (repeatable, overrides the flag matrix below) · `--max-trials N` (default 120;
rows beyond it are NOT RUN, never dropped) · `--wj1` (also run the committed WJ-1 spec on the same stack) · `--keep` (leave the
run directory) · `--app-port` (3651) · `--pg-port` (55691) · `--stub-port` (55692).

Exit codes: `0` works · `1` does NOT work (read the report) · `64-79` the harness could not run, so nothing is claimed.

Unit tests of the rule and the classifier (no browser, no database, a few seconds):

```bash
node --test tests/e2e/journey-ledger/lib/*.test.mjs      # or: npm run test:journey-ledger
node tests/e2e/journey-ledger/lib/mutants.mjs            # breaks one line at a time in ledger.mjs / classify.mjs; every mutant must be killed
```

The two suites also carry **defeat candidates**: deliberately wrong rules (NOT RUN ignored, any PASS suffices, an empty
journey "works", a report or exit code that decides on its own) and wrong classifiers (status-only, inert-is-fine, a model call
scored as the page working, a blocked click hidden as NOT RUN, text-only so a 404 page with words passes). Each must make the
suite fail; a suite that cannot fail proves nothing.

## What `run.sh` starts, and always stops

1. **PostgreSQL 16 shadow**: its own data directory under `$TMPDIR/jl-run.*`, own port, trust auth, `127.0.0.1` only. Schema =
   `database/baseline/0001_baseline_2026-09-01.sql` with the `CREATE EXTENSION vector` line neutralised and applied **without**
   `ON_ERROR_STOP` (pgvector is not installed), the migration ledger stamped from the baseline manifest, then each pending
   migration applied one at a time. About 621 of 634 baseline tables exist and one migration is refused (it needs a vector table).
   The Writer's Studio routes the walk touches work; the vector-backed tables do not exist. The exact counts are printed in the
   report header.
2. **Model stub**: a loopback server that refuses every call and logs a count. The app is started with `ANTHROPIC_BASE_URL` pointed
   at it, so nothing can reach a real provider. A control that triggers a model call is NOT RUN with the reason stated.
3. **`next dev --webpack`** on `http://localhost:PORT` (Turbopack fails with a symlinked `node_modules`). Use **`localhost`, not
   `127.0.0.1`**: Next blocks its dev resources from the 127.0.0.1 origin, so pages return 200 and render blank. Every proxy
   variable is removed from the app's environment and the browser blocks any request that leaves localhost (the blocked hosts, if
   any, are listed in the report).
4. A fresh **fictional rostered member per press** (a member row plus `ops_contacts.metadata.writers_studio_beta`, as WJ-1 does),
   so pressing "Just let me write" (which makes a Work) cannot change the Home the next control is tried from.

On exit (pass, fail, signal) it stops the app's process group, the stub and the database, removes the run directory, removes the
`.next` and `test-results` directories it created, and restores `AGENTS.md` and `next-env.d.ts`, which `next dev` rewrites.
Note: the first time Next 16 runs under an agent it prints an upgrade notice and exits; the harness retries the same command once
and takes no other action on that text.

## The flag matrix the harness boots

**Production's flag values are not in the repository** (not in `.env.example`, compose or CI), so this is the repository's documented
defaults plus the switches the Studio rooms need to open. **They may differ from production**, and a walk under different flags can
find different doors. Override with `--flag K=V`; the values in effect are printed in every report.

| Flag | Value | Source |
| --- | --- | --- |
| `NEXT_PUBLIC_WS_DEVELOP_STAGE` | `1` | compose default (founder ruling 2026-11-09) |
| `NEXT_PUBLIC_WS_AUTO_READ` | `1` | compose default (founder ruling 2026-11-12) |
| `WRITERS_STUDIO_EDITORIAL_ENABLED` | `1` | editorial routes answer 404 without it |
| `WRITERS_STUDIO_FOCUS_ENABLED` | `1` | focus route is off without it |
| `WRITERS_STUDIO_REVIEW_DISCUSS_ENABLED` | `1` | review-discuss routes are off without it |
| `WS_BETA_GRANT_MODE` | `legacy` | `.env.example` default (roster boolean admits) |
| `WS_PRO_GATE_ENABLED`, `WS_FREE_WORK_LIMIT_ENABLED`, `WS_FREE_ADMISSION_ENABLED`, `WS_PRO_TASTE_ENABLED`, `WS_PRO_ASK_ENABLED`, `STUDIO_HOLDINGS_ENABLED` | `false` | `.env.example` defaults |
| `WS_MAIA_METER_MODE`, `WS_STANDING_ENABLED`, `NEXT_PUBLIC_WS_STANDING_ENABLED` | unset | off by default |

`NEXT_PUBLIC_*` values are inlined by the dev server at compile time; `run.sh` sets them before the server starts.

## Persona P1: the first-timer (`personas/p1-first-timer.mjs`)

An adult with an idea and no manuscript, newly invited. Rows:

- `P1-01` signs in through the **real sign-in form**. Every per-press member signs in the same way (not by calling the API alone):
  the form also writes the client-side session cache (`localStorage.memberId`), and some of the product, such as the "Report a
  bug" launcher, appears only when it is set, so an API-only sign-in would walk a different page from a real member's.
- `P1-02` Studio opens (not bounced to sign-in or the invitation page) and Home renders real text.
- `P1-03` zero Works, from the server's own list endpoints, and Home shows no Works list.
- `P1-04` every control visible on Home is listed (buttons, links, disclosures, switches).
- `P1-05.*` each control pressed by a new member. Depth 1 is Home itself. If a press opens a menu or changes the studio view, the
  controls it revealed are pressed too (depth 2, replaying the parent press), and the contents of a menu opened at depth 2 or
  deeper are pressed (depth 3 and 4, only through menus). Each row names its path, for example
  `Home › button “I already have pages” › disclosure “Writing preferences” › disclosure “About Studio access”`.
- `P1-06` nothing was skipped: every control found was pressed and settled.
- `P1-07` the study's `/writers-studio/plans` link (“Free and Pro”, under Writing preferences) leads to a page that renders.
- `P1-08` the four mode buttons (Write, Develop, Review, Publish) each lead somewhere from the zero-Works studio view.

How a press is judged (`lib/classify.mjs`, pure and unit-tested): HTTP status is never enough. A link to a page that answered 200
but rendered under 40 characters, or rendered the framework's "This page could not be found", is a DEAD END. A link whose target
answers 4xx/5xx is a DEAD END even if the client rendered something. A press that changes no URL, text, aria state, dialog, control
count or network request within about three seconds is a DEAD END (unless it is the already-selected choice of a toggle, or it opens
the browser's own file chooser, which changes no DOM). A press that sends a request which fails is a DEAD END. The walk keeps watching
while a request is still in flight (a cold `next dev` compiles an API route on its first call): a screen that says "listening…" is not an
outcome, and a request still pending after 60 s leaves the row NOT RUN. A **disabled** control is NOT RUN (its precondition is unknown to
the harness; "disabled until you choose" is not a defect) unless it states why, which is a PASS. A control that needs a model is NOT RUN.

## Limits (read before trusting a PASS)

- **A PASS means "it led somewhere that rendered", not "it was good, honest or kind".** The harness cannot judge MAIA's conduct,
  the felt experience, or whether where a door leads is right. A DEAD END may be an intended "not yet" state; the row stays DEAD
  END until the product says so in a way a person can read. That question is the product's, not the harness's.
- **Slice 1 has no MAIA step.** No model is called; a control that needs one is NOT RUN. Writing, saving, adopting an edit,
  revision, undo, export and publishing are not walked.
- **One persona, first-visit Home only**, up to three presses deep. Nothing about a returning member, a member with Works, a
  novelist or a memoirist.
- **Development server, not a production build.** Compile-on-first-request makes the first presses slow, and dev-only behaviour
  can differ from `next start`. The harness removes Next's `<nextjs-portal>` dev element (it sits over the bottom-left corner and
  swallows clicks on whatever is under it, including the "Beta journey" button); a click intercepted by anything else is scored as
  the product's.
- **Replaying a path can fail.** Each press replays its parent presses from a fresh Home. Once in 95 presses of the run of record a parent
  control did not reappear in time; that row is NOT RUN with the reason, never PASS, and never a DEAD END. A re-run decides it.
- **Schema is not the production schema**: pgvector-backed tables are absent, so any surface that reads them is not exercised.
- **Flags may differ from production** (see above).
- **Fictional data only**, one fixed fictional password for throwaway members whose database is destroyed.
- Not wired into CI: it needs a PostgreSQL server and a browser. Run it by hand on a Studio-path change.
- The existing `tests/e2e/writers-journey` (WJ-1) is separate and still not referenced by any CI workflow. `--wj1` runs it on this
  stack so it can be re-greened here; its own `run-journey.sh` (Docker + production build) is unchanged.
