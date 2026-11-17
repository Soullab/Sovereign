# Delegated defaults record, 2026-11-17

**Standing: DEFAULTS CHOSEN BY CLAUDE UNDER DELEGATION. NOT FOUNDER RULINGS. NOT RATIFIED CANON.**

These are defaults chosen by Claude under the founder's 2026-11-17 delegation ("make best choices for all"). They are reversible by the founder on one line. They are NOT founder rulings and NOT ratified canon, and they must not be cited as either. Each is labelled DESIGNED or DECIDED-DEFAULT (NOT DELEGATED where no default was chosen), never LIVE: the label LIVE needs runtime evidence at the production tip, which this record cannot supply (`docs/canon/CLAIM_STATE_AUTHORITY.md`: evidence licenses a claim state, a record does not).

Purpose: later sessions neither re-ask these questions nor mistake a default for a ruling. Basis: `origin/clean-main-no-secrets` at commit:`ddf584b28` (2026-11-17). Branch `claude/docs-delegated-defaults-20261117`; one documentation file; no code; not merged. Merging it is a founder act (D4).

## How to use this record

- **Delegation as received.** The choice is delegated for design and product choices inside a draft PR, and only that. D4 lists what is not delegated.
- **Reverse a default on one line.** The founder writes `D<n>: reverse` or `D<n>: instead <choice>`. A later session then edits that section (text and status) before any code follows it.
- **Cite as** "default D<n> in docs/programme/DELEGATED_DEFAULTS_2026-11-17.md (Claude, under delegation)", never as a ruling, ratification or canon.
- **Labels.** DECIDED-DEFAULT: a choice that governs how a draft is built or an act is performed. DESIGNED: specified here, not built, or built only on an unmerged branch. NOT DELEGATED: stays the founder's. A default that does not say what it does NOT authorize authorizes nothing.
- **Evidence.** SOURCE = read at the tip or at a named branch commit. RAN = executed by me. The only thing RAN for this record is the read-only SQL in D2, on a throwaway PostgreSQL 16 built from the repository's own baseline DDL, with fictional rows. Nothing was read from or run against production. PR numbers come from merge-commit subjects or the delegation brief, not from GitHub.
- **The three studies** (practitioner side, idea to publication, stances) are read-only reports, not stored in the repository. They read canonical at commit:`84e12cf00`, 792 commits before the tip (RAN: `git rev-list --count`). Where they differ from the tip, the tip governs; the differences found are listed next.

## Contents

- D1 Practitioner session ownership for the 22 open handlers: fail closed, recoverable
- D2 Host facts the repo cannot know: founder-run, read-only, counts only
- D3 Corrected R20 compose wiring: HOLD on its branch
- D4 Not delegated, stays the founder's
- D5 Decisions raised by the three studies. D5.1 Writer is a bounded PROPOSE act · D5.2 Governed Moves, no stance objects · D5.3 One depth setting, facet parity · D5.4 Sanctuary in the Work and Develop lanes · D5.5 Studio referral control · D5.6 Practitioner-not-informed disclosure · D5.7 Mentor, Keeper of the Why, Companion of return · D5.8 Whole-work reading · D5.9 Retained editing history · D5.10 Teen premise and age · D5.11 Accompaniment object and recipient reading · D5.12 Pointing to humans · D5.13 FR-08.7 beyond Circles · D5.14 Teaching for people who accompany writers · D5.15 Defect lanes · D5.16 Export, delete, right to leave · D5.17 Held doors · D5.18 Structure authoring · D5.19 Enumeration lanes (copy-editing, Brief, claims, citations, production) · D5.20 New moves · D5.21 Refused archetypes · D5.22 Gate and configuration · D5.23 Persona walk set · D5.24 Flow repairs

## Where the studies are stale at the tip (SOURCE)

- **9-versus-8 lens count: not present.** No literal 8 remains in the Develop controller. The pass runs server-side (`lib/writersStudio/studio/passRun.ts`) and derives the eight deep lenses from `LENS_ORDER`; `app/writers-studio/__tests__/editorialPassCompletes.test.ts` runs the runner against stubbed clients and cites the 2026-11-11 production walk. Not run here, so whether the pass completes end to end is UNKNOWN to this record.
- **Sanctuary in the Work and Develop lanes: enforced in source.** See D5.4.
- **`/writers-studio/plans`: a page exists** (`app/writers-studio/plans/page.tsx`); the study's 404 is stale.
- **Still true at the tip:** "Use it" saves MAIA's wording as a member version (D5.1); two depth vocabularies (D5.3); no Writer's Studio route calls the crisis assessor (D5.5); the sections route is PUT only (D5.18); the sources POST refuses with 423 before parsing (D5.17); the practitioner-family identity defect is unfixed on canonical: the session helper PR #2325 adds (`lib/auth/requireSessionMember.ts`) does not exist at the tip, and 14 route files under `app/api/caseload`, `app/api/practice`, `app/api/supervision` and `app/api/practitioners` still read `memberId` or `practitionerId` from the query or body (RAN: `grep -rlE`; the 62-handler count is the #2325 inventory's) (D1).

## D1. Practitioner session ownership for the 22 open handlers

- **Question.** PR #2325 (head commit:`0117fc607`, draft) makes 32 of 62 handlers under `/api/caseload`, `/api/practice`, `/api/supervision` and `/api/practitioners` act as the session. 22 (practice 11, supervision 11) are addressed by a session id alone. `practitioner_id` is nullable on both `practice_sessions` and `supervision_sessions` (`database/baseline/0001_baseline_2026-09-01.sql`), and per the #2325 inventory the live-scribe and studio recorders never send an owner, so many existing rows may have none. Deny unowned rows, backfill an owner, or allow unowned rows?
- **Default.** FAIL CLOSED, RECOVERABLE. Five rules:
  - P1 Owner-only, no existence oracle: a session id the session member does not own answers exactly as an id that does not exist (same status, same body).
  - P2 No unowned rows created: every create path sets the owner to the session member; `supervision/session/start` stops taking `practitionerId` from the body, and its active-session 409 is computed over the session member's own sessions.
  - P3 Legacy unowned rows are unreachable by all 22 handlers. No backfill is built or run. Recovery is a founder-run, audited backfill designed only after a read-only census (counts of NULL-owner rows, the optional third command in D2). The census script is the only artifact built now.
  - P4 Delete is owner-only. `supervision/session/[id]` DELETE is documented "admin only" and checks nothing at the tip (`app/api/supervision/session/[id]/route.ts`). An admin exception only through an existing verified gate: `deriveVerifiedAccess` with `roles.includes('admin')` (pattern at `app/api/admin/partners/prelude/[id]/route.ts`) or `requireFounder()` (`lib/founder/founderAuth.ts`). NOT `requireAdmin(req)` in `lib/security/requireAccess.ts`: its header says it has no importers and must not be used for privileged decisions.
  - P5 Lists return the session member's own rows only (`supervision/sessions` GET, `practice/sessions` list). An empty list for a member whose sessions are all unowned is the accepted cost.
- **Why.** Invariant 17 (`docs/canon/MAIA_SOVEREIGNTY_INVARIANTS.md`): absence of an admission rule means exclusion, so a row nobody owns is admitted to nobody. The #2325 inventory (`docs/programme/PRACTITIONER_API_IDENTITY_INVENTORY_2026-11-17.md`) names the three alternatives: deny breaks legacy rows, backfill has nothing on the row to say whose it is (a guessed owner is manufactured authority), allow leaves the hole on exactly the rows that hold clinical transcripts. Fail closed costs usability and is recoverable by a later audited act; the other two guess or leak and cannot be undone.
- **Would change it.** The census shows unowned rows are rare or absent; a durable owner signal appears that makes a lawful backfill possible; the founder prefers deny-only or allow.
- **Does NOT authorize.** A backfill; a migration; any production read by an agent; changing the permissive `ACCESS_CONTROL_MODE` default; merging #2325 or the stacked PR; touching the 32 handlers #2325 already fixes; UI work beyond a stated empty state.
- **Status.** DESIGNED. Being built as a draft PR stacked on PR #2325; DESIGNED until merged and witnessed. Merging a stacked PR into the #2325 branch is not a merge into canonical (see D3).
- **Owed acceptance test.** Per handler, two accounts on the shared harness (`tests/support/sessionBoundaryHarness.ts` at the #2325 head): A's session against B's id answers identically to a nonexistent id (P1) and no row of B's changes; a NULL-owner row is unreachable by all 22 (P3); the static guard's three open-set ratchets (`app/api/__tests__/practitionerFamiliesIdentityGuard.test.ts`) shrink for these 22. Failing first on the unfixed code, output recorded. Defeat candidates, each must fail by name: owner compare dropped; 403 versus 404 divergence; unowned allowed; backfill on read; body `practitionerId` fallback; admin via `requireAdmin(req)`.

## D2. Host facts the repo cannot know

- **Question.** Production `ACCESS_CONTROL_MODE` and the row count of `portal_inquiries` are UNKNOWN to the repository. How are they learned?
- **Default.** Founder-run, read-only, counts only. Claude does not read production and does not infer either value. The builds proceed identically either way; the answers change only what the founder is told about prior exposure. `ACCESS_CONTROL_MODE` is declared in no tracked compose file (`docker-compose.production.yml` reads the host's untracked `.env.production`).
- **Commands** (as `CLAUDE.md` documents the host; paste the output only):

```
# 1. Mode (the variable is not a secret). The form the 2026-09-15 witness used.
ssh soullab@minisforum 'docker exec maia-sovereign printenv ACCESS_CONTROL_MODE'; echo "exit=$?"

# 2. portal_inquiries: counts only, never a row. Columns checked against database/baseline/0001_baseline_2026-09-01.sql.
ssh soullab@minisforum 'docker exec maia-postgres psql -U soullab maia_consciousness -c "SELECT count(*) AS total, count(practitioner_id) AS with_practitioner FROM portal_inquiries;"'

# 3. Optional, the D1 census precursor: unowned session counts only.
ssh soullab@minisforum 'docker exec maia-postgres psql -U soullab maia_consciousness -c "SELECT (SELECT count(*) FROM practice_sessions) AS practice_total, (SELECT count(*) FROM practice_sessions WHERE practitioner_id IS NULL) AS practice_unowned, (SELECT count(*) FROM supervision_sessions) AS supervision_total, (SELECT count(*) FROM supervision_sessions WHERE practitioner_id IS NULL) AS supervision_unowned;"'
```

- **How to read them.** Mode: `strict` is strict; anything else, including empty with `exit=1` (unset), is permissive, because `getAccessMode()` compares to the exact string `strict` (`config/accessMatrix.ts`), and permissive lets an unmapped route reach its handler. The last witness found it unset on 2026-09-15 (`docs/programme/MAIA-WISDOM-CONSENT-01_REACHABILITY_WITNESS_2026-09-15.md`): a dated reading, not the present state. Count: `with_practitioner` is the number of rows the unauthenticated GET at the tip could list (it filters by the portal's practitioner and checks no session, `app/api/portal/[slug]/inquiry/route.ts`; PR #2324 closes it). Counts cannot show whether anyone read them.
- **Why.** Production is read only by the founder (D4). A count answers the question without a row: the inquiries hold names, emails and phone numbers. RAN: commands 2 and 3 on a disposable PostgreSQL 16 built from the baseline DDL of the three tables, with fictional rows, returned the expected counts and wrote nothing.
- **Would change it.** The founder grants a read-only production path to an agent, or supplies the numbers.
- **Does NOT authorize.** Any agent production access; selecting a content column; paste of rows; changing the mode to `strict` (that flips every unmapped route and is its own act, `docs/programme/MAIA-WISDOM-CONSENT-01_REACHABILITY_WITNESS_2026-09-15.md` section on why a prefix rule, not strict mode).
- **Status.** DECIDED-DEFAULT (procedure). The two values stay UNKNOWN until the founder runs the commands.
- **Owed acceptance test.** The founder's pasted output of commands 1 and 2 is recorded in a later record as a founder-run reading with its date and host, class REPORTED, never as a RAN of mine.

## D3. Corrected R20 compose wiring (PR-C, fixed version)

- **Question.** What happens to the corrected R20 compose wiring, and why did the earlier PR-C mislead?
- **Default.** HOLD on its branch `claude/ops-r20-compose-wiring-fixes-20261109` (tip commit:`ab18da5cc`). Do not open a PR until PR #2190 (branch `claude/ops-worker-vault-mount-20261108`, tip commit:`4cb2a67fe`) has landed on canonical and a host preflight witness exists (`docs/ops/R20_HOST_PREFLIGHT_WITNESS.json`, required by law W8 of `scripts/check-compose-r20-wiring.mjs`, whose CI is red by design until the witness exists, per the commit:`ab18da5cc` message). Even then, opening it is a founder act (D4). Its own decisions D1 to D4 were also taken under delegation (the commit:`ab18da5cc` message) and are revisable.
- **The stacked-merge hazard (SOURCE, RAN `git merge-base --is-ancestor`).** The stack was PR-A (commit:`9a6bb0af1`, vault mount) then PR-B (commit:`0b2e1bfce`, commit:`ec72d485e`, host preflight) then PR-C (commit:`1da89a5db`, wiring). commit:`4cb2a67fe` is "Merge pull request #2192" into the PR-A branch and commit:`cad1ccf44` is "Merge pull request #2193" into the PR-B branch: each merged into a feature branch, not into canonical. As of commit:`ddf584b28` none of commit:`9a6bb0af1`, commit:`0b2e1bfce`, commit:`ec72d485e`, commit:`1da89a5db`, commit:`ab18da5cc`, commit:`4cb2a67fe`, commit:`cad1ccf44` is an ancestor of canonical. A "merged" label on #2193 meant merged into `claude/ops-r20-host-preflight-20261108`. That branch (tip commit:`cad1ccf44`) carries the earlier, unfixed wiring commit:`1da89a5db`; the independent review fixed it in commit:`ab18da5cc`, which exists only on the `-fixes-` branch (the one-shot flag in the shared `.env.production` changed the config hash of ten services). Do not merge `claude/ops-r20-host-preflight-20261108` into canonical (merging is the founder's act in any case, D4). The #2190 branch contains commit:`ec72d485e` and does not contain commit:`1da89a5db`.
- **Why.** The R20 ledger wiring changes how production authority is configured; a half-landed stack is worse than none. `docs/ops/NON_DELIVERY_REGISTER.md` row C2 and the PR-A commit message record that R105 keeps worker deployment on hold; the witness gate exists so a person types the host preflight result once, under the exact names the compose binds.
- **Would change it.** #2190 lands and the witness exists; the founder wants the wiring split differently; the preflight fails on the host.
- **Does NOT authorize.** Opening PR-C; merging any branch in the stack; deploying; running the preflight on the host; creating the witness file by hand; touching `.env.production`.
- **Status.** DECIDED-DEFAULT (hold). The wiring itself is DESIGNED: not in canonical, not rendered against a daemon, not run on a host (the commit:`ab18da5cc` message).
- **Owed acceptance test.** Before any PR: rebase the `-fixes-` branch onto canonical after #2190 lands so the diff is only commit:`1da89a5db` and commit:`ab18da5cc`; `npm run check:compose-r20-wiring` green with a conforming witness; a defeat candidate for each law W1 to W9 as the branch already carries; a stack-integrity check that no commit of the stack is reachable only from a feature branch before any "merged" is reported.

## D4. Not delegated: stays the founder's

- **Question.** What did the delegation not hand over?
- **Default.** Nothing in this list is decided, done or implied by any default here: merging anything (this record's PR, #2324 to #2326, the D1 PR, any stacked PR); deploying anything (code, schema, compose, R20 steps); marking a PR ready for review; enabling auto-merge; lifting the R105 worker-deployment hold (per the brief, merging #2190 would lift it: its own commit message says it mounts `vault_data` read-write into `maia-media-worker`, the transitional shape R105 rendered offline, and that R105 keeps worker deployment on hold); opening the held PR-C; opening any lane an earlier founder act holds (for example WS2-08B to 08E, D5.18); any production access (D2's commands are the founder's to run); any change to canon documents or `CLAUDE.md`; moving any claim state (`docs/canon/CLAIM_STATE_AUTHORITY.md`); ratifying a default here as a ruling.
- **Why.** These are acts of authority, not design choices. `docs/canon/CONSTITUTIONAL_DIRECTION_OF_AUTHORITY.md`: authority moves upward through authored experience and is never manufactured by the system; a delegation to design is not a delegation to commit, ship or ratify.
- **Would change it.** Only the founder, naming the act and the object (for example "merge #2325"), in a session.
- **Does NOT authorize.** Anything. This section grants nothing; it records that nothing was granted.
- **Status.** NOT DELEGATED. No default chosen.
- **Owed acceptance test.** None; nothing is built. Any later record that says an item here happened must cite the founder's act and its date.

## D5. Decisions raised by the three studies

Each placed below as a default that keeps authority with the member and the writer: no guru stance, no manufactured higher-order meaning, no ranking, no authorship by MAIA. All are DESIGNED or DECIDED-DEFAULT; none is built by this record. The invariants cited are in `docs/canon/MAIA_SOVEREIGNTY_INVARIANTS.md`.

### D5.1 Writer is a bounded PROPOSE act, not a stance

- **Question.** Is "Writer" (MAIA drafts on request) a stance or facet, or a declared act under a bound?
- **Default.** A PROPOSE act under a writer-declared bound: per request, expiring with it; a wider scope (this thread, this Work) only by a separate, visible, revocable declaration; MAIA may narrow a bound, only the writer widens it. Nothing changes until the writer's own gesture; adoption stays Use it, Change it, Talk about it, Undo. Precondition before any draft-on-request: repair "Use it" authorship and measure added characters.
- **Why.** Invariant 1 (authority return); the facet law that a facet changes how much MAIA translates and never how much MAIA writes (`docs/programme/WRITERS-STUDIO-CONVERGENCE-01_CHARTER_2026-09-21.md`, section 9.3). SOURCE at the tip: "Use it" stores MAIA's wording as a member version (`app/dev/writers-studio-pc3-live/P4R1WriteEditController.tsx`, `lib/manuscript/editorialRuntime/memberVersion.ts` fixes author `member`), against `lib/manuscript/proposalChain/contract.ts` ("does not author one of their own"); `addedWords` is computed and read by nothing (`lib/manuscript/editorialScope/voice.ts`).
- **Would change it.** The founder rules Writer a stance, or sets a standing per-Work ceiling after the repair and measurement.
- **Does NOT authorize.** Any draft-on-request or insert feature; changing "Use it" in this record; a stance, persona or facet field; MAIA-originated text the writer did not ask for.
- **Status.** DESIGNED.
- **Owed acceptance test.** Authorship pin: after "Use it" the stored version records MAIA's version id as origin (defeat: today's behaviour, author `member` with no origin, fails). Ceiling: a structured proposal over the writer-set added-character ceiling is refused whole (defeat: ceiling computed, not enforced). Type-level pin that the authorship resolver takes no facet argument (defeat: a candidate adds one). Facet effect on added prose is reported by a same-passage, same-grant run, measured not proved; whether drafting feels like authorship transfer is UNKNOWN until a human witnesses it.

### D5.2 Governed Moves, no stance or persona objects

- **Question.** Are Editor, Guide, Teacher, Mentor and Writer stances, persona prompt blocks, turn coordinates, or governed moves?
- **Default.** The five names stay vocabulary for the writer, not objects in the system: no stance field, picker or prompt block. Direction: governed Moves, each a closed act with declared authority (outcome kinds, what it may read, the hand-back), built only when a second consumer needs the table. First work is repairing named leaks (D5.1, D5.4, D5.8), not building the table. MAIA never assigns a Move, facet or level; an offered Move is pressed by the writer and stored as the writer's words.
- **Why.** The names sit on different axes (output, initiative, purpose, memory horizon, authority). The code already types authority by outcome kind (`availableOutcomeKinds` in `lib/manuscript/editorialScope/sequence.ts`, used at `lib/manuscript/editorialRuntime/turn.ts`). Invariants 15 and 16: no runtime member optimization, no manufactured recognition.
- **Would change it.** The founder prefers a different model (the study's judges split 22, 20.5 and 14 across three); a second Move consumer appears.
- **Does NOT authorize.** A Move table; receipts or envelopes; reordering the prompt stack; "Mentor mode" or "Teacher mode" controls; wiring ambient memory producers into any Studio path.
- **Status.** DESIGNED (direction only; the three models are study constructs, not repository facts).
- **Owed acceptance test.** Each Move, when built, ships with a falsifier and a defeat candidate in the `tests/constitutional/` pattern; a static guard that no request key or type introduces `stance` or `persona` (defeat: a candidate adds one); a module-graph test that receipts or stamps are never read back into cognition, shipped in the same change as any receipt.

### D5.3 One depth setting, named by relationship; facet parity measured

- **Question.** Two vocabularies exist: `EditorialDepth` guided, learning, direct (`lib/writersStudio/editorialDepth.ts`) and `ExplanationDepth` plain, guided, craft, deep, expert (`lib/writersStudio/workingStyle.ts`), with a "Go deeper" button that sends `expert` (`lib/writersStudio/developStarters.ts`). Which survives, and where is it stored?
- **Default.** One writer-declared setting, named by the relationship the writer wants from MAIA, never by skill level; the "Expert" and "Advanced view" labels retire into the `EditorialDepth` names; persisted per Work as the writer's declaration (never inferred, never assigned); the same default for every member; changeable without ceremony; one depth source feeding Write, Develop and Ask; no per-turn stamp until a read-back ban test exists. Facet parity is reported as measured by a same-passage, same-grant run, never claimed proved.
- **Why.** The facet contract (convergence charter section 9, FACETS-01) and the earlier L6a to L6e it superseded as current law while keeping their substance (section 8.2): a facet changes translation, not what MAIA finds or writes; no self-classification at the door. Invariants 14 and 15 (a stamp is a behavioural signal).
- **Would change it.** The founder prefers per-act depth, or the ruled Work-establishment selector.
- **Does NOT authorize.** UI build; persistence or migration; renaming any label now; deriving a facet from anything about the member.
- **Status.** DESIGNED.
- **Owed acceptance test.** A static guard that exactly one depth constant feeds the three lanes (defeat: a second constant); a press sends the new depth in the same call (defeat: a stale closure sends the old one); a parity run in which Guided surfaces fewer observations than Direct fails the reachability check.

### D5.4 Sanctuary in the Work and Develop lanes

- **Question.** Is Sanctuary honoured in the Work conversation and the Develop dialogue; are the readings and attention-map commissions the consent event; is an ephemeral editorial mode lawful?
- **Default.** Build nothing further here. SOURCE at the tip: the Work conversation stores nothing in Sanctuary or with an undeclared posture (`app/api/sovereign/manuscripts/[id]/ask/route.ts`); the Develop dialogue refuses before any write for non-work anchors, 409 (same file); the Living Work ask answers in the moment and keeps nothing (`app/api/sovereign/living-works/[id]/ask/route.ts`); readings refuse unless an ordinary posture was declared (`app/api/sovereign/manuscripts/[id]/readings/route.ts`). The attention map runs without a posture check: only its optional letter is keep-gated (kept only when the writer asks and the keep gate allows it) and the usage meter treats the call as Sanctuary (`app/api/sovereign/manuscripts/[id]/attention-map/route.ts`). That stays. The remaining gap is disclosure: the posture threshold should state what Ordinary retains and what leaves the machine; wording human-reviewed, not written here. No ephemeral mode is built; none is ruled.
- **Why.** `CLAUDE.md` Sanctuary invariants 1 and 6 (nothing saved, absolute boundary) and the 2026-11-09 founder rulings in `docs/programme/WS-SANCTUARY-CLOSURE_FROZEN_CANDIDATE_2026-11-09.md` ("Sanctuary blocks every write of something MAIA keeps or learns, never the writer's own manuscript work or a deletion"), merged as PR #2194 (commit:`aead4f6b1`).
- **Would change it.** The founder rules an ephemeral mode; the per-session switch gets server verification (`SANCTUARY-INIT-GATE-01`, not built: the server trusts the device's explicit true or false, per that record).
- **Does NOT authorize.** Weakening any refusal; treating an undeclared posture as Ordinary; calling Sanctuary complete; touching the 2026-11-09 rulings.
- **Status.** DECIDED-DEFAULT (leave as is). Enforcement is in canonical source; production deployment is not witnessed by this record. The disclosure text is DESIGNED.
- **Owed acceptance test.** The existing `tests/constitutional/ws-sanctuary-closure/frozen.probe.test.ts` re-run on the deployed SHA (it needs a database; not run here); a new test that the attention map keeps no letter under Sanctuary or an undeclared posture (defeat: a variant that persists the pass fails); human witness of the posture sentence's comprehension, UNKNOWN until witnessed.

### D5.5 Studio referral control (safety-adjacent)

- **Question.** The Studio has no in-product referral on any conversation lane. SOURCE: no Writer's Studio route or `lib/manuscript` module calls the crisis assessor (`lib/safety/crisisAssessment.ts`); its callers include `app/api/sovereign/app/maia/list/route.ts`. What is the interim card?
- **Default.** A member-initiated control: a static, always-reachable, member-pressed pointer in every Studio room. It is not shown because of anything detected. No inference: nothing reads the member's words or the manuscript to decide whether to show it, nothing scores or labels a person, nothing is stored or sent, MAIA's answers do not change. The text is fixed, versioned and jurisdiction-neutral (it points to a local emergency service and to local directories, naming no country's number), says plainly what MAIA is not (the existing sentence in `lib/safety/crisisAssessment.ts` says MAIA is not an emergency service and should not be relied on to contact help), and needs human review before any build. No copy is written here. This departs from the studies' recommendation of a detector-driven card on the member's typed turn: that infers a state from text, which this default does not authorize.
- **Why.** Option A (`docs/programme/SAFETY-CRISIS-01_OPTION_A_AND_SERVER_DETECTOR_2026-10-01.md`): no human alert channel, so referral and honest disclosure are the layer available; the wording there is the founder's. Fiction and memoir depict harm, so reading manuscript text would misfire; Invariants 1, 5 and 7: no simulated rescue, no certainty, attention returned to the human world.
- **Would change it.** The founder chooses a detector-driven registered producer after a human-witnessed walk on fiction and memoir false positives; counsel's view on obligations; any change to Option A.
- **Does NOT authorize.** Any detector or assessor in a Studio route; wiring the Focus addendum; copy; claiming a safety capability; any alert to a human; changing `/list`.
- **Status.** DESIGNED.
- **Owed acceptance test.** A static guard that no Studio route imports the assessor and that no render path derives the control's visibility from member or manuscript text (defeat: a keyword-triggered variant fails); the control reaches from every room in a journey-ledger row; it writes zero rows and sends nothing; the `tests/constitutional/safety-crisis/` matrix stays green. Wording, comprehension and fit: UNKNOWN until a human reviews and witnesses.

### D5.6 Practitioner-not-informed disclosure (safety-adjacent)

- **Question.** Should each relationship threshold and the Practice Field editor tell both parties that MAIA does not tell the practitioner when it detects distress?
- **Default.** Yes, as a design: one versioned, human-reviewed sentence at every threshold, sent as a client notice reference and never server-defaulted; any copy implying a practitioner is notified by MAIA is reconciled (the study names "has been notified" copy and a "Crisis escalation" persona default; neither re-verified at the tip). No sentence is written here.
- **Why.** Option A: disclosure is the open dependency (`docs/programme/SAFETY-CRISIS-01_OPTION_A_AND_SERVER_DETECTOR_2026-10-01.md`, lines 76 and 77) and the wording is the founder's. Invariant 5: no implied rescue.
- **Would change it.** The founder opens a practitioner-routed, consented path; counsel's view on duties.
- **Does NOT authorize.** A practitioner alert channel; shipping copy; any statement that MAIA notifies anyone; changing Option A.
- **Status.** DESIGNED.
- **Owed acceptance test.** A copy-truth guard: any string implying MAIA notifies a human is absent unless a delivery path is built (defeat: reintroduce one); the sentence appears at every threshold (ledger row); comprehension UNKNOWN until witnessed.

### D5.7 Mentor, Keeper of the Why, Companion of return

- **Question.** Can MAIA hold "the long arc" of a writer's development?
- **Default.** No Mentor persona and no arc. What is buildable is a member-pulled return of the writer's own existing dated words (append-only turns, saved versions), quoted byte for byte with their stored date, only when the writer asks in that turn. Keeper of the Why returns the writer's own declared purpose and asks whether the book or the section is changing; Companion of return restores place and treats a resting Work as resting. Declarations orient and never grade; no streaks, nudges or summaries. An append-only, writer-owned declaration log is not authorized.
- **Why.** Any "when I wrote" from MAIA is fabrication; Invariants 3 and 7; the Compass is auxiliary material and licenses nothing about the text (`docs/programme/WRITERS-STUDIO-CONVERGENCE-01_CHARTER_2026-09-21.md`, section 10.3); `docs/canon/CONSTITUTIONAL_DIRECTION_OF_AUTHORITY.md` (no manufactured higher-order meaning).
- **Would change it.** The founder authorizes the declaration log; D5.9 (the member door) lands.
- **Does NOT authorize.** Arc summaries; ambient memory wiring; Compass persistence; any return of retained history before D5.9.
- **Status.** DESIGNED.
- **Owed acceptance test.** A returned item equals a stored record and carries its stored date (defeat: a paraphrase fails); nothing returns unless asked (defeat: an unprompted return fails); the module is not imported by any cognition aggregation. Whether a return reads as grading is UNKNOWN until witnessed.

### D5.8 Whole-work reading

- **Question.** After the lens-count fix: composition over the read ceiling; the overview lens asking "What deserves the writer's attention first?" against the no-ranking rule; the "where I would start" focus against permanent `editorial-consequence`.
- **Default.** The ceiling is a recorded founder ruling and stays (`lib/manuscript/developmentalReader/contract.ts`, "STAYS at 500,000"): refused whole, nothing trimmed; a plain, cause-specific precheck before the press is DESIGNED; the PASS unit (synthesis over observations, coverage stated) stays DESIGNED. Observations are presented unranked, in manuscript order, all reachable. The overview question is a prioritization prompt (`contract.ts`); the default is that prioritization is a separate act the writer commissions, labelled MAIA's suggestion with its basis visible, never default-on. "Where I would start" follows the same rule.
- **Why.** The convergence charter's ranking ruling (section 4: unranked, all reachable); Invariant 1; `docs/canon/CONSTITUTIONAL_DIRECTION_OF_AUTHORITY.md`.
- **Would change it.** The founder rules a ranking acceptable by default, or raises the ceiling after measurement.
- **Does NOT authorize.** Changing the ceiling; editing the lens contract text; removing "where I would start" from the live UI now.
- **Status.** DECIDED-DEFAULT for ranking (prioritization is commissioned, not default); DESIGNED for the precheck and PASS.
- **Owed acceptance test.** Presentation order equals manuscript position (defeat: a severity sort fails); an overview request without a prioritization commission carries no prioritization instruction (defeat: today's `contract.ts` text, which fails once the test exists, as intended for the PR that changes it); at 500,000 and 500,001 code points the precheck names the cause truthfully; the lens-count boundary test stays green and fails against a candidate that hard-codes 8 (not verified here).

### D5.9 Retained editing history: a member door

- **Question.** Should a writer be able to see and delete a conversation, as the precondition for any Mentor-like return?
- **Default.** Yes, as a DESIGNED door whose first deliverable is an honest inventory of where a writer's words live. Until it exists, no return reads retained history, and the retained state is described as the lane record describes it: retained by design, reachable only partly (`docs/programme/WS-DELETE-01_R-SHARED_WORK_CARD_EXIT_AND_CUSTODY_NOTICE_LANE_RECORD_2026-11-05.md`, the editorial-history rows, where retention was itself "decided under delegation, not by a founder ruling").
- **Why.** Consent for memory ("no stealth memory", `CLAUDE.md`); Invariant 1; right to leave.
- **Would change it.** The founder rules retention unacceptable, or rules Remove must refuse a Work that has any.
- **Does NOT authorize.** Deleting any history; touching append-only triggers; a schema change; promising "unreachable".
- **Status.** DESIGNED.
- **Owed acceptance test.** After a member's delete, no route that accepts a retained id returns the turn (defeat: a route still accepts it); the inventory lists every table that holds member words and is checked against the schema; R20 and recovery implications stay with the WS-DELETE lane.

### D5.10 Teen premise and age

- **Question.** Record the youth environment as Designed only; treat a minor signal in the Studio as an admission failure; wire the youth gate at registration; for practitioner flows, attestation or "unknown fails closed".
- **Default.** The youth environment is recorded as DESIGNED only: SOURCE at the tip, `checkYouthAdmission` (`lib/youth/youthAdmissionGate.ts`) has one non-test caller, `app/api/members/profile/route.ts`; the Work-program age gate (`lib/studios/workAgeGate.ts`, commit:`ea6cc946b`) is a different mechanism, for College Essay Works. A minor signal in the Studio is reported as an admission defect; MAIA never infers age from text. Wiring the gate at registration stays DESIGNED, not decided. For any practitioner flow: adults only in v1, with a member-sent adult attestation recorded for both parties, no class that may include under-18s; `lib/members/adultConfirmation.ts`, which the contracts cite, does not exist at the tip.
- **Why.** Invariant 17; `docs/programme/SAFETY-CRISIS-01_OPTION_A_AND_SERVER_DETECTOR_2026-10-01.md` line 14 (confirm what applies to minors before teen registration reopens; not verified by counsel).
- **Would change it.** Counsel's view; the founder's choice of "unknown fails closed" (the study notes it conflicts with a null-is-adult reading, not re-verified here).
- **Does NOT authorize.** Reopening teen registration; an age field or age inference; any class that may include minors; claiming a youth environment.
- **Status.** DESIGNED.
- **Owed acceptance test.** A static guard that no Studio or practitioner route derives age from text; an admission refusal precedes any MAIA read (the pattern commit:`ea6cc946b` pins, with a defeat that removes one route's gate); counsel review is human and UNKNOWN until done.

### D5.11 Accompaniment: a sibling object; the recipient's MAIA does not read the Work

- **Question.** Widen Coach Field or relationship spaces, or a sibling object; and may a recipient's MAIA read the writer's body text (never, only with the writer present, or delegated)?
- **Default.** A sibling object: writer-proposed, Work-scoped, one fixed shape, bilateral, state derived from append-only declarations, no role, tier or status column, claimed through an identity-bound step the writer confirms (the study reads the join-token pattern as seating the first claimer; not re-verified). It reuses the Bring Forward law (`lib/coachField/bringForward.ts`) and the authorization-act pattern (`lib/disclosure/authorizationAct.ts`). Coach Field is not widened: `lib/coachField` has no importer under `app/` or `components/` at the tip. Recipient reading: never now (the paste path stays open and Sanctuary does not make pasting safe); only with the writer present stays DESIGNED; delegated by an absent author is refused. Rooms persist nothing. No directory, no practitioner-initiated access.
- **Why.** Invariants 2 and 17 (no exclusive bond; membership declared, never inherited from a role); roles are acts a person performs over a Work, not accounts.
- **Would change it.** The founder rules widening Coach Field, or permits the present-writer reading.
- **Does NOT authorize.** Any schema, migration or slice; claiming "MAIA supports those who help writers" (not Live); practitioner-side surfaces.
- **Status.** DESIGNED. Slice 1 only after the defect lanes (D5.15), witnessed register lines, adult attestation (D5.10) and a Co-Lab gate ruling.
- **Owed acceptance test.** Two-account identity binding on a shadow; room isolation; no ordinal reply fields; offering immutability; delete-then-restore removes the offering; turn-manifest parity with and without an Accompaniment; a defeat where a bearer token seats the first claimer fails.

### D5.12 Pointing a writer to humans

- **Question.** Offer a note, a directory, or nothing; and what of Press step 2 and a registry of human doors?
- **Default.** A steward-authored, versioned, unranked, category-level note that names no person, firm or fee, offered when the writer asks and at an honest limit of what MAIA can do; if asked, Soullab says plainly that it has no directory. A registry of human doors (each with a real contact, or not listed) is DESIGNED later. Press step 2 gets a real door or is removed (PR #2326 covers closed doors; awareness only).
- **Why.** Invariant 7; claim discipline (`docs/canon/MARKETING_CLAIM_DISCIPLINE.md`): no door named that lacks a walked row; ordering must be non-evaluative.
- **Would change it.** A vetting stance, a report path that reaches a human, adult assurance and a non-evaluative ordering rule exist (the preconditions for a directory).
- **Does NOT authorize.** A directory, vetting, fees, any named door; writing the note text; implying a human is reachable.
- **Status.** DESIGNED.
- **Owed acceptance test.** Every offered door has a journey row ending sent, held, reason or room opened; the note contains no proper name (defeat: add one) and no popularity ordering (defeat: a sort).

### D5.13 FR-08.7 beyond Circles

- **Question.** Extend FR-08.7 (no counts, scores, ranks, streaks, badges, leaderboards or trust levels as surface), ruled for Circles in `docs/programme/JARVIS-CIRCLES-01_FOUNDER_RULINGS_2026-09-06.md`, to practitioner products?
- **Default.** Yes as a design constraint for every new practitioner or accompaniment design drafted in this lane. It does not amend FR-08 and does not retire any existing ladder.
- **Why.** Invariants 3 and 4; the Circles record's D-I2 refusal to reuse status-economy mechanics.
- **Would change it.** The founder rules the extension, which supersedes this default, or declines it.
- **Does NOT authorize.** Removing or fencing the commons contribution ladder, the "mastery" rung, the length-based badge or Pro-tier auto-curator (named by the study; not verified at the tip); each is its own act.
- **Status.** DECIDED-DEFAULT.
- **Owed acceptance test.** A design-review item, plus a static check that new migrations in the lane add no column named score, rank, tier, streak or badge (defeat: a candidate adds one).

### D5.14 Teaching for people who accompany writers

- **Question.** "Teach me how to help a writer revise" hits a keyword rule that maps writing words to `writing_rhetoric` (`lib/maia/teaching/TeachingRuntimeBridge.ts`); the study says that rule matches first and that the domain is barred on practitioner surfaces, so binding throws and the turn runs with no directive (not re-verified). Fix now, or a new surface?
- **Default.** Fix the detector so the domain choice is surface-aware and a refusal is visible to the member, not a console warning. No new accompanist surface or domain: reopening the frozen teaching contracts for exactly one surface is a founder act and needs a bounded plural set of named craft traditions.
- **Why.** Invariant 14 (no single tradition presented as the craft); a silent downgrade is a false claim to the member.
- **Would change it.** The founder reopens the teaching contracts for one surface.
- **Does NOT authorize.** A new teaching domain or surface; changing the frozen contracts.
- **Status.** DESIGNED.
- **Owed acceptance test.** On a practitioner surface, a writing-craft query yields a visible "not available here" outcome (defeat: a console-only variant fails); on a writer surface it still resolves.

### D5.15 Defect lanes: separate, smallest each, blockers first

- **Question.** Separate lanes, only the two blockers, or fold them into the practitioner model?
- **Default.** Separate, smallest each, blockers first: portal inquiry (PR #2324), practitioner identity (PR #2325), the 22 session handlers (D1), then the rest the study names (role-bound shared-thread read, `with-me` cross-member atom writes, Co-Lab `maia-reflect` on others' messages, relationship-space exit), each a draft PR with a falsifier and a defeat candidate. The role-bound shared-thread read ships together with relationship binding, never as a bare params fix.
- **Why.** A defect fixed inside a model is held hostage to the model; Invariant 17.
- **Would change it.** The founder bundles them, or reorders.
- **Does NOT authorize.** Folding into Accompaniment; any practitioner claim; merging.
- **Status.** DECIDED-DEFAULT.
- **Owed acceptance test.** Per lane: two accounts on a shadow, a static identity guard, a defeat candidate per fix; failing first on the unfixed code.

### D5.16 Export, delete honesty, right to leave

- **Question.** Fix the privacy and account copy now, and ship a plain export of the writer's own words?
- **Default.** Copy first: promise only what the routes do (PR #2326 is that lane; awareness only). Then, as its own later draft, a plain TXT, Markdown or DOCX export of the whole Work, labelled uncertified, ahead of PDF and EPUB certification; delete refusals shown as reasons. SOURCE: member PDF and EPUB export is hard-off (`lib/manuscript/render/memberBookExportRelease.ts`); exports PDF and EPUB are not certified and permanent erasure is not certified (`lib/writersStudio/releaseAuthority.ts`).
- **Why.** Right to leave; Invariant 1; claim discipline: a promise must match behavior.
- **Would change it.** The founder wants the export first, or certifies erasure.
- **Does NOT authorize.** Certifying any export or erasure; editing `releaseAuthority.ts`; marketing "export everything"; deploy.
- **Status.** DECIDED-DEFAULT (copy first); DESIGNED (export).
- **Owed acceptance test.** A copy-truth test tying each promise to a route behavior (defeat: re-add "export everything"); an export round trip on a fictional Work returns every section in order, the writer's words only, byte-equal to what is stored.

### D5.17 Held doors

- **Question.** Controls offered open and closed behind: remove or label each, or give each a hold-aware capability read?
- **Default.** Remove or label each until real, plus a test that every offered control ends in sent, held, a stated reason, or a room opened. SOURCE at the tip: the sources POST refuses with 423 before parsing (`app/api/writers-studio/sources/route.ts`) while the release manifest reads `sourceIntakeReleased: true` (`lib/writersStudio/releaseAuthority.ts`); the two may address different intake paths, not resolved here. PR #2326 is the closed-doors lane; this record chooses nothing against it.
- **Why.** Claim discipline: a door that offers what is held tells tomorrow's story today.
- **Would change it.** The founder prefers hold-aware capability reads.
- **Does NOT authorize.** Lifting any hold; editing the manifest.
- **Status.** DECIDED-DEFAULT.
- **Owed acceptance test.** A crawl in which every offered control ends in one of the four states (defeat: a control that returns nothing fails).

### D5.18 Structure authoring (WS2-08C, design only)

- **Question.** Open the smallest increment of section authoring now?
- **Default.** NO. Design only: no code and no draft PR. At most a written design note, for the shape of add, rename or move of one section in manuscript order: member-confirmed, no ranking, through a proposal the writer confirms, MAIA proposing and never enacting. Split, merge, 08B (member-confirmed imported hierarchy), 08D (nested write gestures) and 08E (the structure ledger) are not designed here. SOURCE at the tip: the sections route is PUT only (`app/api/sovereign/manuscripts/[id]/sections/[sectionId]/route.ts`), so no gesture adds or removes a section, and `lib/writersStudio/studio/capability.ts` records `structure.restructure` as `absent`. The lane is held by founder acts that predate this delegation and that it does not lift. `docs/programme/WS2-08_HIERARCHICAL_MANUSCRIPT_STRUCTURE_DECIDE_2026-09-06.md` (status line: 08B HOLD, 08C code HOLD, 08D and 08E unauthorized; "Sequencing correction (founder act, 2026-09-06)") and `docs/programme/WRITERS_STUDIO_PROGRAMME_BOARD.md` (08B to 08E each require a separate founder act; 08C to 08E UNAUTHORIZED); the latest mention, `docs/programme/WRITERS-STUDIO_WRITE-DEVELOP_FUNCTION_INVESTIGATION_2026-11-03.md`, still says they need a founder act. No later record in `docs/programme` opens any of them (SOURCE: read, not exhaustively searched). Two preconditions bind any later code. First, 08B precedes 08C. Second, "no mutating topology command may exist before a minimum structure revision/digest binding does", or the first mutations act on a tree whose prior state cannot later be identified. A third binds rename: `docs/programme/EDITORIAL-LEGACY-LOCUS-DISPOSITION-01_2026-09-15.md` B5, also written into `lib/manuscript/proposalChain/legacyLocus.ts`: "WS2-08C may not open without accounting for immutable editorial loci", because a rename would make today's reliable discriminator unreliable. Rename and reorder (moving a section) are in the DECIDE record's 08C list; adding a section is a topology change that the digest-binding rule covers, though that list does not name it. The delegation covers, at most, this written design; it covers neither code, nor a PR of any kind, nor any 08B to 08E step.
- **Why.** Invariants 1 and 15: the Work is organized by the member's own confirmation. And D4: a delegation to design is not the founder act that opens a lane an earlier founder act holds.
- **Would change it.** The founder opens 08B by a named act, then the digest binding, then 08C, each by its own act; or holds the lane as it stands.
- **Does NOT authorize.** Any 08B to 08E code, draft PR or migration; opening, reordering or skipping steps of the 08B to 08E sequence; lifting any hold in the three records above; ranking of sections; MAIA enacting a structure change.
- **Status.** DESIGNED, design only. Gated by founder acts (08B HOLD, 08C code HOLD, 08D and 08E unauthorized); nothing is built and nothing is opened.
- **Owed acceptance test.** None now. If the founder later opens the lane, after 08B and the digest binding: after add, rename or move, order equals the member-confirmed order and source characters are unchanged; undo restores; a topology change only through an explicit member command. Defeat candidates, each must fail by name: a command that reorders by "importance"; a mutating command with no prior revision/digest binding; a rename that changes a heading an immutable editorial locus was frozen against.

### D5.19 Enumeration lanes: copy-editing, Brief, claims, citations, production

- **Question.** Copy-editing, a Brief keeper, a claim ledger, a citation steward, a production manager and a technical-content custodian: model lenses, or something else?
- **Default.** Where authority rests on exhaustive enumeration, build deterministic tools with a handoff pack, never another model lens. Copy-editing and register keeper: exact-occurrence enumeration of terms, names, units and style from a writer-declared style sheet; MAIA lists occurrences and claims no confident completeness. Brief keeper: the writer declares audience, venue, length and conventions, held apart from the voice lens, never inferred. Claim ledger and citation steward: mechanical matching against text the writer supplied; never completes a reference or asserts a source exists. Production manager and metadata: a writer-declared book record, only once exports are certified. Technical content (code, tables, equations, figures): later. Proofreading, fact-checking and rights reading stay human (D5.12).
- **Why.** Invariant 5 (no incomplete claim presented as complete); Invariant 14 (non-English headings and fonts); `docs/programme/WRITERS-STUDIO-CONVERGENCE-01_CHARTER_2026-09-21.md` scope control (section 3): nothing without substrate appears in any menu.
- **Would change it.** The founder rules a declared style sheet or brief lawful against the voice lens.
- **Does NOT authorize.** Any of these as a menu entry or promise; external quote or source verification (no substrate).
- **Status.** DESIGNED.
- **Owed acceptance test.** On fictional text with N planted occurrences the tool returns exactly N with offsets (defeats: a lens that misses one; a variant that "corrects" text); the steward never completes a missing reference (defeat); a style sheet is never an input to the voice lens (defeat).

### D5.20 New moves: Midwife, Witness, Finisher, member-invoked Skeptic

- **Question.** Which new moves are lawful, and when?
- **Default.** Each only as a member-pulled, bounded, labelled act, never a stance or persona. Midwife (idea stage): draws out the writer's own sentences and hands them back unchanged; waits on the arrival and Compass question (Compass persistence is not authorized). Witness (a private room that receives raw pages and does not improve them): blocked until an ephemeral mode is ruled (D5.4) and the referral control exists (D5.5). Finisher: helps the writer declare their own pass finished; MAIA never certifies readiness. Skeptic: "what supports this claim?" asked of covered text, labelled, never default, no external verification.
- **Why.** Invariants 1 and 5; readiness is the writer's act; the verdict-giver refusal (D5.21) would otherwise be a dead end.
- **Would change it.** The founder rules the arrival and Compass lane open.
- **Does NOT authorize.** Any of them as a menu entry or promise; Compass persistence.
- **Status.** DESIGNED.
- **Owed acceptance test.** Midwife output is a byte-substring of the writer's own text (defeat: a paraphrase); readiness is set only by a writer gesture (defeat: a MAIA-set "ready"); Skeptic cites only covered text and asserts no verification (defeat).

### D5.21 Refused archetypes: ghostwriter, verdict-giver, cheerleader

- **Question.** Which archetypes are refused as personas or menu entries?
- **Default.** Refused: ghostwriter or co-author, verdict-giver ("is it good, is it ready, will it sell"), cheerleader. The bounded revision proposal (D5.1) remains; readiness stays the writer's or a human's act; reflection stays descriptive and evidence-bound (the overview text in `lib/manuscript/developmentalReader/contract.ts` already says "do not grade, rewrite, or turn an impression into a verdict").
- **Why.** Invariants 3, 4 and 5 (no dependency, no emotional capture, no simulated certainty); no authorship by MAIA.
- **Would change it.** Only the founder, by ruling.
- **Does NOT authorize.** Removing the proposal move; adding any of the three under another name.
- **Status.** DECIDED-DEFAULT.
- **Owed acceptance test.** A static guard: no persona noun in request keys or menus (defeat: add one), no `verdict`, `score` or `grade` field on observation types (defeat: add one). How replies to "am I a real writer?" read: UNKNOWN until a human witnesses.

### D5.22 Gate and configuration

- **Question.** Add a scoped Studio test job to the canonical PR checks; commit a production-variable manifest?
- **Default.** Yes to both, as DESIGNED drafts: a scoped jest job over named Studio test files (the shape of `.github/workflows/astro-pro-independent-fixture.yml`), with the vitest suites registered or excluded by name; a manifest listing the NAMES of the Studio flags (`WRITERS_STUDIO_EDITORIAL_ENABLED`, `WRITERS_STUDIO_REVIEW_DISCUSS_ENABLED`, `WRITERS_STUDIO_FOCUS_ENABLED` and the others the code reads) and `R20_*`, never values, with one declared walk profile; the full `test:ci` baseline measured in parallel. SOURCE at the tip: `.github/workflows/canonical-pr-quality.yml` gates typecheck, DB bootstrap and JARVIS proofs and states broad unit tests are not gated; no workflow names the Studio; none of those flag names appears in `docker-compose.production.yml` or `.env.example`.
- **Why.** Boundary defects pass every part-level check; the repo's own header names CANONICAL-PR-UNIT-GATE-02 as the measurement before any broad gate.
- **Would change it.** The baseline shows the broad gate is affordable; the founder prefers it.
- **Does NOT authorize.** Making broad tests blocking; editing workflows from this record; reading production flag values (founder-run, as D2).
- **Status.** DESIGNED.
- **Owed acceptance test.** The job fails on a planted red Studio test (defeat); a static check that any `WRITERS_STUDIO_*` variable read in code is in the manifest (defeat: add an unlisted read).

### D5.23 Persona walk set

- **Question.** Authorize a standing journey ledger and fixtures?
- **Default.** Yes, as a DESIGNED instrument: each step PASS, DEAD END or NOT RUN, and "works" is forbidden while any row is NOT RUN; a stubbed model; a fresh rostered member; fictional fixtures (a 90k-word novel, a 120k-word technical Markdown book); Case A walked later as a person, and a non-founder reading transcripts. It builds on `tests/e2e/writers-journey/` (WJ-1). A machine PASS makes mechanics eligible for human witnessing; it promotes nothing and cannot judge MAIA's conduct or a writer's felt experience.
- **Why.** The failures the studies found were boundary defects between parts that each pass; a journey is the layer that sees them.
- **Would change it.** The founder wants it gated or deferred.
- **Does NOT authorize.** Any production run; real credentials or real people's data; wiring into required CI (D5.22 is separate).
- **Status.** DESIGNED.
- **Owed acceptance test.** `--defeat` modes so the harness can fail (a harness that cannot fail does not pass the writer); a planted dead end must produce DEAD END.

### D5.24 Flow repairs the studies name

- **Question.** Work-state declaring control, the presentation-intent parser that swallows content questions, the first Teach-me press sending the old depth, the silent 24-correction cap, the Undo window: decisions, or repairs?
- **Default.** Repairs, each its own draft PR with a falsifier and defeat candidate; none decided here. SOURCE at the tip: a grep of `app/writers-studio`, `app/dev/writers-studio-pc3-live` and `lib/writersStudio` finds `manuscriptState` read but not written by any client; the parser file exists (`lib/writersStudio/presentationRequests.ts`); the others are not re-verified. The Undo window is the one product choice among them: it stays as recorded until a draft shows a section-local precondition is safe.
- **Why.** A dead end or silent cap is a loss of place; Invariant 1.
- **Would change it.** The founder ranks any as urgent.
- **Does NOT authorize.** Changing Undo semantics; any UI change from this record.
- **Status.** DESIGNED.
- **Owed acceptance test.** One per repair, with content-question cases for the parser and a stale-closure defeat for the depth press.

## Traceability: every decision the three studies raise

- **Stances study, 8 decisions:** Writer stance D5.1 · Sanctuary D5.4 · "reaches a human" D5.5 · Mentor D5.7 · whole-work reading D5.8 · depth vocabulary D5.3 · retained history D5.9 · teen premise D5.10.
- **Practitioner study, 10:** defect lanes D5.15 · crisis floor D5.5 · not-informed sentence D5.6 · Accompaniment D5.11 · recipient reading D5.11 · age D5.10 · FR-08.7 D5.13 · teaching D5.14 · pointing D5.12 · export and delete D5.16.
- **Idea-to-publication study, 9 plus archetypes:** held doors D5.17 · structure D5.18 · crisis D5.5 · Sanctuary D5.4 · right to leave D5.16 · ceiling D5.8 · register D5.3 · gate D5.22 · walk set D5.23 · late layers D5.19 and D5.12 · new moves D5.20 and D5.7 · refused D5.21 · Governed Moves D5.2.

## Doubts carried

- The studies' file and line citations were not trusted; every fact above was re-read at the tip or marked not re-verified.
- This record declares no mechanism that records or reports and delivers to no one, so no line is added to `docs/ops/NON_DELIVERY_REGISTER.md`; the absence of a Studio referral path is recorded in the Option A record.
- `npm run check:record-shas` refuses a shallow clone (exit 2) and was not run; every commit reference in this file was checked with `git cat-file -t` instead. References to unmerged branches resolve in CI only while those branches exist on origin. PR numbers #2190, #2324 to #2326 come from the delegation brief; #2192, #2193 and #2194 from merge-commit subjects; GitHub was not consulted.
- Where I departed from a study's recommendation: D5.5 only. The studies recommended a detector-driven card on the member's typed turn; this record chooses a member-initiated control because a detector infers a state from text.
- One file only was allowed, so the failing-first check for this record (structure, citations, opening statement, no unsupported capability claims, no secrets) lives outside the repository and is not part of this change.
