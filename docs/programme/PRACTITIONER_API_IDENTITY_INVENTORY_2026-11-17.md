# Practitioner API identity inventory — 2026-11-17

Unit: **PRACTITIONER-API-IDENTITY-01** · Class A (security) · base `ddf584b28` (canonical tip, 2026-11-16) ·
branch `claude/fix-practitioner-identity-session-20261117`.

Evidence classes: **SOURCE** = read in the repository at the base commit; **RAN** = executed in this
session (jest, in a disposable worktree; fictional data; no database, no network, no production access).
Nothing here was read from or run against production.

> **Later the same day — PRACTITIONER-SESSION-OWNERSHIP-01** closed every row below marked OPEN (the 22, the 4, and the
> two that read identity from the request). The sections below are kept as written; the last section,
> "Session-ownership follow-up", carries the final table and supersedes them.

## What was wrong

Under `app/api/caseload/**`, `app/api/practice/**`, `app/api/supervision/**` and
`app/api/practitioners/**`, handlers took *who is acting* from the request itself — `?memberId=` /
`?practitionerId=` on GET, `memberId` / `practitionerId` in the JSON body on writes — and scoped every
read and write to that value. The stores' ownership predicates (`practitioner_id = $2`) were only as
strong as a value the caller chose, so account A could name B's member id and be answered as B.
`/api/caseload` and `/api/practice` also carried **no** access-matrix rule (the `/caseload` *page* did),
so in the default permissive mode an unmapped path reached its handler with no session at all.

## Method

A handler-level census: every exported `GET|POST|PUT|PATCH|DELETE` in the 38 route files under the four
prefixes (**62 handlers**). For each handler the identity channels in its body were classified, at the base
commit (**before**) and in this change (**after**), by the same scanning approach the static guard uses
(`app/api/__tests__/practitionerFamiliesIdentityGuard.test.ts`): `session` (a session helper is called),
`query` (`.get('memberId'|'practitionerId'|…)`), `body` (destructure / property read of those keys from a
request body), `none`. The table below was generated from `git show HEAD:<file>` and the working tree, not
typed by hand.

## Result

| | handlers |
|---|---:|
| **FIXED** — identity moved from query/body/none to the session | **32** (caseload 16 · practice 12 · practitioners 4) |
| already session-derived, unchanged | 6 |
| public by design (no identity needed) | 2 |
| **OPEN** — no session identity (addressed by a resource id only) | **22** (2 of them also read identity from the request) |
| total | 62 |

Of the 6 already-session handlers, 3 still act on *any* session id without comparing the session member to
its owner (listed below); `practice/sessions` GET is fixed for its list branch only.

## Table

| route (under `app/api/`) | method | before | after | status |
|---|---|---|---|---|
| `caseload/[caseId]/captures` | GET | query | session | FIXED |
| `caseload/[caseId]/captures` | POST | body | session | FIXED |
| `caseload/[caseId]/captures` | DELETE | body | session | FIXED |
| `caseload/[caseId]/consultations` | GET | query | session | FIXED |
| `caseload/[caseId]/consultations` | POST | body | session | FIXED |
| `caseload/[caseId]/list` | GET | query | session | FIXED |
| `caseload/[caseId]/list` | PATCH | body | session | FIXED |
| `caseload/[caseId]/list` | DELETE | body | session | FIXED |
| `caseload/[caseId]/memories/list` | GET | query | session | FIXED |
| `caseload/[caseId]/memories/list` | POST | body | session | FIXED |
| `caseload/[caseId]/memories/search` | POST | body | session | FIXED |
| `caseload/[caseId]/notes` | GET | query | session | FIXED |
| `caseload/[caseId]/notes` | POST | body | session | FIXED |
| `caseload/[caseId]/patterns` | GET | query | session | FIXED |
| `caseload/list` | GET | query | session | FIXED |
| `caseload/list` | POST | body | session | FIXED |
| `caseload/transcribe` | POST | session | session | already session |
| `practice/growth` | GET | query | session | FIXED |
| `practice/growth` | POST | body | session | FIXED |
| `practice/growth` | PATCH | none | session | FIXED |
| `practice/insights/generate` | POST | none | none | OPEN: no session identity (resource id only) |
| `practice/insights/generate` | GET | none | none | OPEN: no session identity (resource id only) |
| `practice/insights/list` | GET | none | none | OPEN: no session identity (resource id only) |
| `practice/insights/list` | POST | none | none | OPEN: no session identity (resource id only) |
| `practice/preferences` | GET | query | session | FIXED |
| `practice/preferences` | POST | body | session | FIXED |
| `practice/session/start` | POST | body | session | FIXED |
| `practice/session/stop` | POST | none | none | OPEN: no session identity (resource id only) |
| `practice/session/worlds` | GET | none | none | OPEN: no session identity (resource id only) |
| `practice/session/worlds` | POST | none | none | OPEN: no session identity (resource id only) |
| `practice/sessions` | GET | query | session | FIXED (list); OPEN: the `?sessionId=` lookup is unowned |
| `practice/sessions` | PATCH | none | none | OPEN: no session identity (resource id only) |
| `practice/transcript` | GET | none | none | OPEN: no session identity (resource id only) |
| `practice/transcript` | POST | none | none | OPEN: no session identity (resource id only) |
| `practice/worlds/detect` | POST | none | none | OPEN: no session identity (resource id only) |
| `practice/worlds/experiments` | GET | query | session | FIXED |
| `practice/worlds/list` | GET | none | none | public by design |
| `practice/worlds/practitioner` | GET | query | session | FIXED |
| `practice/worlds/practitioner` | POST | body | session | FIXED |
| `practice/worlds/practitioner` | PATCH | body | session | FIXED |
| `practice/worlds/suggest` | POST | body | session | FIXED |
| `supervision/insights/list` | GET | none | none | OPEN: no session identity (resource id only) |
| `supervision/insights/stream` | GET | none | none | OPEN: no session identity (resource id only) |
| `supervision/scribe` | GET | none | none | OPEN: no session identity (resource id only) |
| `supervision/session/[id]/essence` | GET | none | none | OPEN: no session identity (resource id only) |
| `supervision/session/[id]` | GET | none | none | OPEN: no session identity (resource id only) |
| `supervision/session/[id]` | PATCH | none | none | OPEN: no session identity (resource id only) |
| `supervision/session/[id]` | DELETE | none | none | OPEN: no session identity (resource id only) |
| `supervision/session/start` | POST | body | body | OPEN: acting identity read from the request |
| `supervision/session/stop` | POST | none | none | OPEN: no session identity (resource id only) |
| `supervision/sessions` | GET | query | query | OPEN: acting identity read from the request |
| `supervision/transcript/list` | GET | session | session | already session; OPEN: acts on any session id (ownership unchecked) |
| `supervision/transcript/list` | POST | none | none | OPEN: no session identity (resource id only) |
| `supervision/transcript/stream` | POST | session | session | already session; OPEN: acts on any session id (ownership unchecked) |
| `supervision/transcript/stream` | GET | session | session | already session; OPEN: acts on any session id (ownership unchecked) |
| `supervision/upload` | POST | session | session | already session |
| `practitioners/check` | POST | body | session | FIXED |
| `practitioners/check` | GET | none | none | public by design |
| `practitioners/create` | POST | body | session | FIXED |
| `practitioners/onboarding` | GET | query | session+query | FIXED (client id kept as a resource id, checked `member_id = $2`) |
| `practitioners/onboarding` | POST | body | session+body | FIXED (client id kept as a resource id, checked `member_id = $2`) |
| `practitioners/verify-passcode` | POST | session | session | already session |

## The rule that was applied

* The acting identity is the **session**: `requireSessionMember(request)` (`lib/auth/requireSessionMember.ts`)
  wraps the existing canonical resolver `getMemberIdFromRequest` and adds a uniform 401. **No fallback to a
  caller-supplied value**, in any handler.
* A client id that stays on the wire is a **resource id** (a case id, a capture session id, a growth row id,
  a `practitioners.id`), and is checked against rows the session member owns. A row that is not theirs is
  indistinguishable from one that does not exist (404). `acknowledgeGrowth` gained the owner in its
  predicate (`practitioner_growth.practitioner_id` is `NOT NULL`, so no legacy-unowned case arises there).
* Clients may keep sending `memberId` / `practitionerId`; the server ignores it. **No UI was changed.**
* Access matrix: explicit `minTier: 'free'` rules for `/api/caseload/` and `/api/practice/` (the
  authentication boundary only, same posture as `/api/supervision` and `/api/invites/`). The permissive
  default and `ACCESS_CONTROL_MODE` are unchanged. No role requirement was added: the handlers never had one,
  and `rolesAnyOf: ['practitioner']` would refuse the member whose first case auto-enables practitioner mode.
  `/api/supervision` already carried a rule; it is pinned by a test, not edited.

## Behaviour changes a reviewer should know about

1. A request with no session now gets **401** where it used to get a 400 ("memberId required") or, worse,
   an answer. Handlers that took the id from a *claimed* value and had no session at all now refuse.
2. `GET /api/practice/sessions` with no `practitionerId` used to list **every** practitioner's sessions; it now
   lists only the session member's.
3. `GET /api/practice/worlds/experiments` without `?worldId=` no longer 400s for a missing `practitionerId`;
   it returns the session practitioner's own feed.
4. `DELETE /api/caseload/[caseId]/list` no longer needs a request body.
5. `POST /api/practitioners/check` is **public in the access matrix**; the handler is now its only gate and
   answers 401 without a session (it used to return any member's practice slug, name and **email** for a body id).
6. Matrix: unauthenticated requests to `/api/caseload/*` and `/api/practice/*` are now refused at the edge (401)
   in both modes. ⚠️ Plain `fetch(apiUrl(...))` callers carry no `x-session-token` on a native/Safari
   cross-origin WebView (the CLAUDE.md Capacitor trap). `components/supervision/PracticePanel.tsx` is the one
   such caller of these two prefixes (`worlds/list`, `insights/generate`). The same condition already applies to
   the rest of `/app/supervision`, which sits under the pre-existing `/api/supervision` rule. UI was **not**
   touched; this is flagged, not fixed.

## What is NOT done, and why (named; enforced as law by the static guard's open sets)

All three sets are **ratchets** in `app/api/__tests__/practitionerFamiliesIdentityGuard.test.ts`: they cannot
grow, and fixing a handler without removing its entry **fails** the test.

### OPEN — no session identity, 22 handlers

`practice`: `insights/generate` GET+POST · `insights/list` GET+POST · `session/stop` POST · `session/worlds`
GET+POST · `sessions` PATCH · `transcript` GET+POST · `worlds/detect` POST.
`supervision`: `insights/list` GET · `insights/stream` GET · `scribe` GET · `session/[id]/essence` GET ·
`session/[id]` GET+PATCH+DELETE · `session/start` POST · `session/stop` POST · `sessions` GET ·
`transcript/list` POST.

These are addressed by a **session id alone**. The ownership check they need is blocked on one decision:
`practice_sessions.practitioner_id` is **nullable**, `getSession()` falls back to `supervision_sessions`, and
that table's `practitioner_id` is only set when a client sends one — the live-scribe and studio recorders
(`lib/studio/RecordingContext.tsx`, `app/labtools/scribe/page.tsx`) never do. So most existing rows have **no
owner** (SOURCE; the row counts are unread — production was not touched). Options, none chosen here:
(a) deny unowned rows — breaks `PracticePanel` and the `/supervision` list for existing rows;
(b) backfill an owner — nothing on the row says whose it is;
(c) allow unowned — leaves the hole for exactly the rows that hold PHI transcripts.

Two of the 22 additionally read acting identity from the request:

* `supervision/session/start` POST — `body.practitionerId`. Swapping in the session identity also decides the
  active-session 409 (today enforced only when the client supplied the id) and starts giving every new session
  an owner. A product decision, not a mechanical swap.
* `supervision/sessions` GET — `?practitionerId=`, and with none it lists every supervision session. Scoping it
  to the session member empties the list for the unowned majority.

Also in this set: `supervision/session/[id]` DELETE is documented "admin only" and checks nothing.

### OPEN — authenticated, but acts on any session id (ownership unchecked), 4 handlers

`practice/sessions` GET (the `?sessionId=` branch) · `supervision/transcript/list` GET (lab-gated) ·
`supervision/transcript/stream` POST and GET. Same root cause and same decision as above.

### Observed, not changed

* `POST /api/caseload/[caseId]/notes` stores a client-supplied `linked_capture_session_id` unverified. Its only
  dereference is `/api/studio/scribe/summary`, which checks `member_id = $2` itself (SOURCE), so nothing leaks.
* `practitioners/onboarding` and `practitioners/verify-passcode` have no access-matrix rule (unmapped, permissive
  default). Their handlers now/already derive the session; adding matrix rules was outside the three prefixes
  named for this unit.
* `/api/practice/worlds/experiments?worldId=` is a catalogue branch and needs no identity.

## Verification (RAN)

Failing-first, then green, with the same test files. See the commit message for the verbatim red output.

* `app/api/caseload/__tests__/identityFromSession.test.ts` — all 17 caseload handlers, two accounts
* `app/api/practice/__tests__/identityFromSession.test.ts` — the 12 practice handlers whose identity changed
* `lib/practice/__tests__/acknowledgeGrowthOwner.test.ts` — the one SQL boundary this unit changed
  (`acknowledgeGrowth`: `WHERE id = $1 AND practitioner_id = $3`). The practice route suite above mocks
  `PracticeStore` wholesale and its mock enforces ownership itself, so it cannot see the SQL: a mutant of the
  real store with the predicate dropped passed 8 suites / 133 tests. This suite runs the REAL function over a
  fake `query` that evaluates the WHERE clause (it refuses predicates it cannot model), pins the statement and
  its parameters, and carries 6 wrong stores that must each be caught. It models one statement; PostgreSQL is
  not run.
* `app/api/practitioners/__tests__/identityFromSession.test.ts` — check, create, onboarding GET+POST
* `app/api/__tests__/practitionerFamiliesIdentityGuard.test.ts` — static guard, handler-level, + 17 defeat candidates
* `config/__tests__/practitionerApiAccessRules.test.ts` — matrix rules, default unchanged, + 7 defeat candidates
* `tests/support/sessionBoundaryHarness.ts` — the shared two-account check (I1–I5), also run against 5–6 wrong
  handlers per family, each of which must be caught
* `app/api/__tests__/rawIdentityAuthorityGuard.test.ts` — the pre-existing `?memberId=` ratchet tightened 29 → 19

---

## Session-ownership follow-up — PRACTITIONER-SESSION-OWNERSHIP-01

Branch `claude/fix-practitioner-session-ownership-20261117`, stacked on `claude/fix-practitioner-identity-session-20261117`
(PR #2325, head `0117fc607`). Class A (PHI-adjacent). Evidence classes as above: **SOURCE** = read in the repository;
**RAN** = executed in this session (jest and `node --test` against fakes; a throwaway PostgreSQL 16 with fictional rows).
Nothing was read from or run against production, no credential was used, nothing was pushed.

### The policy (founder-delegated 2026-11-17: FAIL CLOSED, RECOVERABLE)

Privacy outranks convenience: a leaked transcript cannot be recalled; a row that is unreachable can be restored later by an
audited backfill.

* **P1** a `practice_sessions` / `supervision_sessions` row is reachable through these routes only by the practitioner who
  owns it. A non-owner, an unowned legacy row and an absent id are indistinguishable: **404, same status, same body**
  (no 403, no existence oracle). The owner is the SESSION member, compared to `practitioner_id` **inside one SQL statement**
  (`lib/auth/requireOwnedSession.ts`), never a request value.
* **P2** every route that creates a session derives the owner from the session; no unowned row is created any more.
* **P3** legacy rows whose owner is NULL are unreachable here. Recovery is a founder-run, audited step **not built**: only a
  read-only census (`scripts/ops/census-unowned-practitioner-sessions.mjs`). No backfill, **no claim endpoint** (a claim flow
  would let anyone claim someone else's legacy session).
* **P4** `DELETE /api/supervision/session/[id]` is **owner-only**. It was documented "admin only" and checked nothing. No admin
  gate exists under `/api/supervision` (SOURCE: `grep` for `requireAdmin|isAdmin|requireFounder|isFounderMemberId` over the four
  families and `lib/supervision`, `lib/practice` finds only the comment), and a platform-wide delete of a practitioner's PHI
  session would be an exposure of its own, so there is nothing to defer to. The statement carries the owner as well
  (`DELETE … WHERE id = $1 AND practitioner_id = $2 RETURNING id`), and zero rows deleted reads as the same 404.
* **P5** `GET /api/supervision/sessions` lists only the session member's own sessions (`?practitionerId=` ignored).

### Final table — every handler that names a session by id (SOURCE; all RAN-tested)

| route (under `app/api/`) | method | before | after |
|---|---|---|---|
| `practice/insights/generate` | POST | no auth, any session | session + owner-only |
| `practice/insights/generate` | GET | no auth, any session | session + owner-only |
| `practice/insights/list` | GET | no auth, any session | session + owner-only |
| `practice/insights/list` | POST | no auth, adds an insight to any session | session + owner-only |
| `practice/session/stop` | POST | no auth, stops any session | session + owner-only |
| `practice/session/worlds` | GET | no auth, any session | session + owner-only |
| `practice/session/worlds` | POST | no auth, records a world on any session | session + owner-only |
| `practice/sessions` | GET (`?sessionId=`) | session, returns any session | session + owner-only (list branch unchanged: own) |
| `practice/sessions` | PATCH | no auth, updates any session | session + owner-only |
| `practice/transcript` | GET | no auth, PHI transcript of any session | session + owner-only |
| `practice/transcript` | POST | no auth, writes into any session | session + owner-only |
| `practice/worlds/detect` | POST | no auth; `recordDetections` wrote into any session | session; a named `sessionId` is owner-only |
| `practice/worlds/suggest` | POST | session; a named `sessionId` revealed which worlds any session used | session; a named `sessionId` is owner-only (**found by the new generic law**, not in the old open sets) |
| `supervision/session/[id]` | GET | no auth, any session (+ transcript/insights/jobs) | session + owner-only |
| `supervision/session/[id]` | PATCH | no auth, any session | session + owner-only; title statement also carries the owner |
| `supervision/session/[id]` | DELETE | "admin only", checked nothing | session + owner-only; owner in the statement |
| `supervision/session/[id]/essence` | GET | no auth, any session (could trigger a synthesis run) | session + owner-only |
| `supervision/session/stop` | POST | no auth; flushed a segment, started the assembler, stopped ANY session | session + owner-only **before** any of those side effects |
| `supervision/insights/list` | GET | no auth, any session | session + owner-only |
| `supervision/insights/stream` | GET (SSE) | no auth, any session | session + owner-only |
| `supervision/scribe` | GET (SSE) | no auth, transcript + insights + analysis of any session | session + owner-only |
| `supervision/transcript/list` | GET | Lab Tools gate, any session | Lab Tools gate + owner-only |
| `supervision/transcript/list` | POST | no auth; checked only the FIRST segment's session | session; EVERY session id in the batch must be the caller's, else the whole batch is refused and nothing is written |
| `supervision/transcript/stream` | POST | session, any session | session + owner-only, checked before the audio is examined |
| `supervision/transcript/stream` | GET (SSE) | session, any session | session + owner-only |
| `supervision/sessions` | GET | `?practitionerId=`, and with none listed EVERY session | session member's own sessions only |
| `supervision/session/start` | POST | owner read from `body.practitionerId`; recorders never sent one, so most sessions were unowned | owner = session member, always; 401 without a session |
| `supervision/upload` | POST | already session-derived (creates the session) | unchanged: owner = session member |

Population: 62 handlers in the four families. **60** derive a session identity; the other **2** are public by design
(`practice/worlds/list` GET, `practitioners/check` GET). **25** name an existing session by id and are owner-gated; **3** create
sessions (`practice/session/start`, `supervision/session/start`, `supervision/upload`), all owned by the session member;
**2** list sessions, both scoped to the session member. The three open ratchets in
`app/api/__tests__/practitionerFamiliesIdentityGuard.test.ts` went **2 / 22 / 4 → 0 / 0 / 0** and are pinned empty.

### Decisions taken inside the delegation (each can be reversed by editing one place)

1. **The old "Active session already exists" 409 on `supervision/session/start` is removed, not extended.** It ran only when the
   client sent `practitionerId` in the body — the channel this unit closes — and no client in this repository ever did
   (SOURCE: `/supervision` mounts `SupervisionRecorder` without a `practitionerId` prop; `labtools/scribe` and the studio
   `RecordingContext` never send one). Enforcing it for every practitioner would be a NEW lockout: a session left open by a
   crashed tab would block the next recording and no surface can stop it. Behaviour is preserved for every in-repo client; an
   external caller that relied on the 409 loses it. Pinned by a test (a second start while one is open succeeds, both owned).
2. **Ownership is one SQL statement, in both tables, with no `OR`/`IS NULL`/`COALESCE`** (a test pins the source), and an id
   that is not a UUID reads as absent without reaching SQL (reaching it would be a PostgreSQL 22P02, i.e. a 500 that tells a
   different story).
3. **A database error is not an allow**: it propagates and the route answers 500.
4. **Ownership never changes** (no route writes `practitioner_id` after creation), so routes check once and then act; the one
   destructive act (DELETE) and the title UPDATE also carry the owner in their own statement.
5. **No token-in-URL fallback for the two SSE routes that became authenticated** (`insights/stream`, `scribe`): `EventSource`
   carries the `maia_session` cookie, like `transcript/stream` GET already did. A `?_t=` query token would put a session token
   in access logs; that is a separate design decision.

### Clients changed (P2) — plain `fetch(apiUrl(...))` → `apiFetch(...)`

A bare `fetch` carries no `x-session-token` on a native / Safari cross-origin WebView (the Capacitor cookie trap), so the
callers of the routes that newly require the session were converted: `components/supervision/SupervisionRecorder.tsx`
(start, stop, transcript poll), `EssenceViewer.tsx`, `InsightsViewer.tsx` (the polling fallback), `PracticePanel.tsx` (worlds
list, insights generate GET and POST — this also closes the PracticePanel flag raised for the `/api/practice/` matrix rule
above), `TranscriptViewer.tsx` (transcript list ×2) and `app/supervision/page.tsx` (sessions list, insights list). Already
`apiFetch`: `labtools/scribe` start/stop and the studio `RecordingContext`. A static guard
(`app/api/__tests__/practitionerSessionCallersGuard.test.ts`) keeps a bare `fetch` from coming back.

**Deliberately not changed, named in the guard with reasons:** `app/labtools/scribe/page.tsx` `transcript/stream` and `upload`
(already authenticated routes before this unit, bare fetch — pre-existing exposure, unchanged) and
`components/masters/FieldSessionListener.tsx` (same-origin relative URL, web only; it still sends `practitionerId=`, now ignored).

### User-visible consequences (stated, not softened)

* **Legacy unowned sessions disappear from every surface that reaches them through these routes.** They are not in the
  `/supervision` history list; their detail, transcript, insights, essence, stop, PATCH and DELETE answer 404; `PracticePanel`
  insights for such a session answer 404 (the panel's own error/empty state shows). Nothing was deleted or altered: the rows
  are intact and a founder-run audited backfill can restore them. How many there are is **unread** (production was not
  touched) — that is what the census is for.
* **Sessions started from now on are owned** and appear in the practitioner's own list; an owned session works exactly as before.
* **`supervision/session/start` now needs the session**: a client with none gets 401 instead of an unowned row.
  `scripts/supervision-demo-stream.mjs` and `scripts/smoke/supervision-smoke.sh` post to `/api/supervision/transcript`, a path
  with no route (SOURCE), so they were already stale and are now stopped one step earlier.
* **`EventSource` consumers on a client that cannot send the cookie** (a native / Safari cross-origin WebView) lose the live
  `insights/stream` and `scribe` streams (401). `InsightsViewer` falls back to its poll, which now uses `apiFetch`; the
  scribe stream has no polling fallback. Same-origin web is unaffected.
* **`POST /supervision/transcript/list`** now needs the session (a Python transcriber that posted anonymously would get 401;
  no such caller exists in this repository — the only ones are the two stale scripts above).

### Census — READ ONLY, built, not run

`scripts/ops/census-unowned-practitioner-sessions.mjs` (`node --test scripts/ops/test-census-unowned-practitioner-sessions.mjs`):
counts only, per table `total / owned / unowned`, and for the unowned rows how many carry a deterministic ownership hint in
existing columns — `supervision_sessions.metadata->>'scribeSessionId' → scribe_sessions.member_id`,
`supervision_sessions.case_id → practitioner_cases.practitioner_id`, and `practitioner_growth.session_refs ∋ practice_sessions.id →
practitioner_growth.practitioner_id` (cited by one practitioner / by several). It selects no row, id, name, title or transcript
text (the output is built only from values that parse as non-negative integers), runs in one `BEGIN READ ONLY`, refuses to run
without `DATABASE_URL`, has no write flag, and exits non-zero on any error. A hint names a column that already points at a
member; it is **not** a verdict that the session belongs to them. **It has not been run against any real database.**

### Verification (RAN)

* Failing-first, on the unfixed tree (`0117fc607`): the two route suites, the static guard and the callers guard were run
  before the fix. Route suites: 40 failed / 29 passed (the 29 are defeat candidates and controls that must pass on any tree);
  static guard 15 failed; callers guard 5 failed. The helper suite and the census tests are new files, so their "red" is only
  "module not found".
* After the fix: `lib/auth/__tests__/requireOwnedSession.test.ts` 19, `app/api/practice/__tests__/sessionOwnership.test.ts` 31,
  `app/api/supervision/__tests__/sessionOwnership.test.ts` 39 (the behavioural suites run every handler against two accounts, a
  legacy unowned row, an absent id and a malformed id), the static guard 48, the callers guard 10, the census 16 (`node --test`).
  Every suite carries named defeat candidates (owner ignored in SQL, owner trusted from query/body, 403-vs-404 oracle, list
  unfiltered, unowned allowed, delete without owner, session id only, gate after the write, gate result ignored, batch checks
  only the first id, no UUID guard, no authentication).
* Mutation sweep (not committed): every `requireOwnedSession` gate and every `requireSessionMember` call in the practice and
  supervision route files (the 18 this unit changed and the #2325 ones beside them) was removed or replaced one at a time;
  **52 / 52** mutants in the 18 changed files were killed by the two behavioural suites. The 10 further survivors of the sweep are
  all in #2325 routes this unit did not change (`growth`, `preferences`, `session/start` (practice), `worlds/experiments`,
  `worlds/practitioner`); those are covered by their own suite, which that sweep did not run.
* Throwaway PostgreSQL 16.15 (initdb in a `mktemp` dir, fictional rows, the real `practice_sessions` / `supervision_sessions` /
  `practitioner_growth` / `practitioner_cases` / `scribe_sessions` migrations): the exact committed statements, extracted from
  the sources, passed 28 / 28 checks, and two deliberately wrong predicates (owner ignored; unowned allowed) failed 4 and 3 of
  them. This probe is **not committed**.
* ⛔ Not claimed: every store in the route suites is a fake; no browser or WebView was run; the real `next dev` was not run;
  nothing was run against production data.

### Not done, and why

* No backfill, no claim endpoint, no recovery of legacy rows (P3).
* No `?_t=` SSE token (decision 5), so native-WebView SSE clients are not repaired.
* `caseId` on `session/start` is still stored as the client sent it (as before); sessions never read the case through it.
* A DELETE of a supervision session removes its transcript segments, `supervision_insights` and jobs (they carry
  `ON DELETE CASCADE`), but NOT any `practice_insights` rows that cite it: `20260110000005` dropped that table's foreign key so it
  could reference either session table, and `20260110000006` is an insert-time trigger only. Unchanged and pre-existing; the route
  never cleaned them up. Named here so the next reader does not assume otherwise.
* The `?memberId=` pin in `rawIdentityAuthorityGuard` (19) is exact and **unchanged** by this unit: none of the 26 handlers read
  `memberId` (they read `practitionerId`, which the family guard pins). Nothing to tighten there.

