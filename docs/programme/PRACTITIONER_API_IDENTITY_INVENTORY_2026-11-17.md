# Practitioner API identity inventory — 2026-11-17

Unit: **PRACTITIONER-API-IDENTITY-01** · Class A (security) · base `ddf584b28` (canonical tip, 2026-11-16) ·
branch `claude/fix-practitioner-identity-session-20261117`.

Evidence classes: **SOURCE** = read in the repository at the base commit; **RAN** = executed in this
session (jest, in a disposable worktree; fictional data; no database, no network, no production access).
Nothing here was read from or run against production.

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
