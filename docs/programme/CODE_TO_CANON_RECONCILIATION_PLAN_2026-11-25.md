# Code-to-Canon Reconciliation Plan — 2026-11-25

**Standing:** PROPOSED plan for founder adjudication. Working note, admitted as a record by founder ruling ("Yes, docs PR", 2026-11-25); admission is custody, not ratification. **It authorizes no source change,
migration, deployment, production read or new taxonomy.**
**Follows:** `docs/programme/EPISTEMIC_TELEOLOGICAL_DISCERNMENT_REVIEW_2026-11-25.md` and the #1982 pointer
(issuecomment-7169374241).
**Bound ref:** `clean-main-no-secrets` @ `54459ca3ea`. **Evidence:** code-read plus static reachability.
No runtime evidence.
**Founder guidance incorporated (in session, 2026-11-25):**
- Heuristic, not doctrinal, intelligence.
- "Every interpretive framework is an instrument of attention, not an authority over reality."
- Improve the implementation; don't discard the wisdom.
- Consent, privacy and sovereignty are governing boundaries and are not flexible.
- Fidelity is not teleological: human telos ≠ developmental emergence ≠ MAIA's fidelity.

---

## 1. The sorting rule

Each item is placed in exactly one class. The class decides the kind of remedy.

| Class | Meaning | Remedy |
|---|---|---|
| **B: Boundary breach** | Touches consent, provenance, sovereignty, dependency (Invariants 3, 4, 15, 16; Sanctuary; Right to Remain Unpossessed) | Not negotiable. Bring into conformance or hold. |
| **C: Premature closure** | A rich heuristic reduced to a single fixed label, rank or default | Keep the heuristic. Make it plural, revisable, abstaining and provenance-marked. |
| **H: Heuristic in proper use** | A framework the member chose, offered as a possibility | Keep. Refine wording only. |

## 2. Prioritized items

Priority = boundary risk × static reachability. Static reachability = code paths found by grep from
`app/` routes. It is not traffic.

### P0-a · Awareness ladder shapes MAIA's stance: class **B + C**
- **Static reachability: STRONG.** `getConsciousnessPolicy` (`lib/sovereign/maiaService.ts:487`) calls
  `inferAwarenessLevel` (:533) and is invoked on the **FAST path (:907, applied :1705)** and the **CORE
  path (:1856, applied :2195, :2284)** of `getMaiaResponse` (:3072). That function is imported by
  `app/api/sovereign/app/maia/route.ts`, `…/maia/list/route.ts` and `app/api/journal/reflect/route.ts`.
- **Why B:** system-inferred developmental state shapes the response. That is the exact harm refusal-16
  names, but refusal-16 only lists `relational_phase` and `autonomy_streak`. It also violates
  `SOULLAB_LIVING_ORIENTATION_SYSTEM.md:234` (no ladder assigning a stage).
- **What to keep (heuristic):** the developmental literature as MAIA's *internal attention space*. That
  means several candidate readings, held as hypotheses and never assigned to the member as a level.
- **Remedy direction (proposed):**
  - Explicitness of framework language follows the **member's own language and requests**: member-marked
    or in-encounter signals, under the existing `admitPersistedStateForShaping` model.
  - It does not follow bead count, Aether share or balance.
  - Add `awarenessLevel` to `INFERRED_DEVELOPMENTAL_FIELDS`.
- **Behavioral tests:**
  1. *Invariance:* two synthetic members with an identical message and history wording, differing only in
     bead count or Aether share, get identical policy explicitness and framing guidance.
  2. *Admission:* a member who asks for framework language ("talk to me in Spiral terms") gets it, as a
     member-marked admission.
  3. *Negative:* no response, prompt or addendum contains a level name ("Newcomer" … "Master") applied
     to the member.
  4. *Guard:* refusal-16 is extended to cover `awarenessLevel`, and `check:refusals` is wired into a
     blocking CI workflow. At present it runs locally only.
- **Runtime evidence needed first (requires authorization):** count of production log lines
  `🧬 [Policy] Level` and `🧬 [Awareness Adaptation]` over a window. Counts only, no content, no user IDs
  exported. This settles whether the ladder is live.

### P0-b · Unconsented LoRA fallback: class **B** (already HELD on #1819)
- Keep HELD. No change proposed here.
- Learning research may use only fictional or independently authorized material.
- **Test (when the hold is lifted, not before):** a static guard that any script reading `maia_turns`
  for training filters on an explicit training-consent field. No such field exists today (per #1819),
  so this is **RULING_REQUIRED**.

### P1-a · Inferred `teloi` without provenance: class **B**, with the heuristic preserved
- **Static reachability: WEAK to UNKNOWN.**
  - `TeleologyService` is imported only within `lib/memory/bardic/`.
  - `extractTeloi` has no found caller. `checkBalance` is called (`ConversationMemoryIntegration.ts:343`).
- **What to keep:** inquiry into emerging purpose. MAIA *accompanies* purpose and does not assign it.
- **Remedy direction:** a telos exists only as **member-authored**, or as **MAIA_PROPOSED → offered →
  confirmed/rejected**. Reuse the epistemic-join `MAIA_PROPOSED` kind and the tagger's
  `offered/confirmed/rejected/retired` lifecycle. No new taxonomy.
- **Behavioral tests:**
  1. MAIA never states a telos the member has not authored or confirmed as fact about the member.
  2. A rejected telos is never re-offered within the tagger's existing gate.
  3. Sanctuary sessions produce no telos rows.
  4. A schema test that rejects telos rows lacking author and status.
- **Runtime evidence (requires authorization):** whether `teloi` exists in production and its row count.
  Count only; never read `phrase`.

### P1-b · Engagement-weighted effectiveness: class **B**
- **Static reachability: UNKNOWN.**
  - Imported by `PersonalOracleAgent`, `MAIAUnifiedConsciousness`, `UnifiedMemoryInterface` and
    `substrateMap`.
  - The constructor gates on `NEXT_PUBLIC_DATABASE_URL` + `DATABASE_SERVICE_KEY`. That is Supabase-era
    shape and probably disabled.
- **Nothing to keep:** session continuation is not a development signal (Invariant 4).
- **Remedy direction:**
  - If confirmed dormant, record it as dormant debt.
  - If live, replace the signals with member-reported growth or follow-through (what Invariant 4
    permits), or retire them.
  - Also check `CLAUDE.md` "If you see Supabase in code, remove it." Whether that covers this is a
    routing question.
- **Behavioral or static test:** a refusal-registry guard that no scoring function adds weight for
  `sessionContinued`, session length or `engagement_score`.

### P1-c · Streak milestones: class **B**
- **Static reachability: PARTIAL.**
  - `blessing-moments` is used by `app/api/_backend/src/agents/BardicAgent.ts`.
  - `ElementalAlchemyAnalytics` has no importer under `app/`, `lib/` or `components/`.
- **Remedy direction:** remove streak milestones from member-facing blessings. Continuity may be
  acknowledged without counting it.
- **Test:** extend the existing `now-what-v1-consequential-return.test.ts:598` "no streak" pattern to
  every member-facing blessing output.

### P2-a · Unified Field placeholders presented as readings: class **C**, plus epistemic honesty
- **Static reachability: STRONG.** `formatFieldAddendum` is on the FAST path
  (`maiaService.ts:1711-1724`). Two docs call Unified "orphaned"; the code disagrees. Docs and code have
  drifted, and that drift is itself a finding.
- **What to keep:** the field as a way for MAIA to attend to several dynamics at once.
- **Remedy direction:**
  - Missing inputs become *absent*, not 0.5, 0.8 or 0.2.
  - Every value in the addendum carries the canonical turn's existing `participationClass`
    (computed / inferred / declared) or is omitted.
  - No constant is ever presented as a measurement.
- **Behavioral tests:**
  1. With no PFI input, the addendum contains no element weights.
  2. Every numeric value in the addendum has a provenance tag.
  3. The addendum is never byte-identical across two members with different inputs merely because of
     defaults.

### P2-b · Elements as a single regex-argmax label: class **C**
- **Static reachability: STRONG** for the bridge and `normalizeElement`. The detailed trace is not done.
- **What to keep:** elements as qualities and dynamics, as ECA-00 already states ("process over label").
- **Remedy direction:**
  - Return a distribution with an **abstain/ambiguous** outcome.
  - Unknown input stays unknown; never default to Earth.
  - Output never says "you are X."
  - Consolidating the 89 element literals into one type that *conforms to ECA-00* adds no classification
    and implements frozen canon. Treating Aether as a fifth peer versus ECA-00's Fifth-Field Law is a
    **RULING_REQUIRED** item, since code and canon disagree on structure.
- **Behavioral tests:**
  1. Mixed-element input yields multiple elements or abstains, not a forced winner.
  2. Empty or unknown input → null.
  3. No member-facing text assigns a type ("You are Fire").
  4. A `shadow` class never appears as an element.

### P3 · "Name levels/stages/states when helpful": class **H** (downgraded)
- **Correction to the review:** this text is injected **only when the member chooses the Integral path**
  (`app/api/between/chat/route.ts:820,1631`). The `auto` default does not inject it and states "Stance
  changes require consent" (`epistemicPathPrompt.ts:85-96`). That satisfies Invariant 14's
  member-initiated gate.
- **Refinement only:** reword to "name stages as possibilities the member may recognize, never as an
  assessment of them."
- **Test:** under the Integral path, no output assigns the member a stage.

## 3. Governance custody (from this session)

- **Stewardship Constitution: FOUND, not admitted.** `docs/governance/JARVIS_STEWARDSHIP_CONSTITUTION_2026-08-12.md`
  was added in `fb8fb0833e` (2026-08-12) on `chore/jarvis-stewardship-custody` (local) and
  `origin/chore/backup-jarvis-custody`. It is **not an ancestor of the default branch.**
- **Founder Escalation Contract: NOT FOUND** in any ref in this clone's history, and not on disk under
  `/Users/soullab` to depth 6. Absence is about these searches. It may exist under another name or
  elsewhere.
- Admitting either to the default branch is a founder act through the documentation admission process.

## 4. Sequence (proposed)

1. **Founder adjudication** of this plan's classes and priorities.
2. **Runtime evidence, authorized separately:** counts-only checks for P0-a, P1-a, P1-b and P1-c. No
   member content is read.
3. **Tests before code:** write the behavioral tests above as failing tests that pin the canon. That is a
   repository change and needs its own authorization.
4. **Remedies in priority order**, each as the smallest reversible unit, under existing owners and lanes
   per `docs/PRIORITY_THREAD_LOG.md`. Owner routing was not checked in this session.
5. **Admission** of the review note, this plan and the Stewardship Constitution through the existing
   documentation admission process.

## 5. Open rulings (each asked once, with a recommended answer)

| # | Question | Recommended ruling |
|---|---|---|
| R1 | Do developmental, elemental and teleological frameworks stay, as attention heuristics bounded by member-marked admission? | **Yes.** Matches founder guidance and Invariant 14. |
| R2 | Should "Every interpretive framework is an instrument of attention, not an authority over reality" enter canon? | **Propose as a canon candidate.** It is close to Invariant 14 and "spiritually intelligent, not spiritually authoritative" but not stated verbatim. |
| R3 | Aether as fifth peer (code) vs Fifth-Field Law (ECA-00)? | **Code conforms to ECA-00**, since ECA-00 is frozen canon. |
| R4 | Training-consent field for any learning pathway? | **Required before any hold is lifted.** |
| R5 | Stage the seven-stance mapping onto `Jurisdiction`? | **Defer until P0–P2 are reconciled.** No new taxonomy now. |

## 5a. Runtime evidence for P0-a (counts only; founder-authorized in session, 2026-11-25)

**Live binding:**
- Production `maia-sovereign` reports `GIT_COMMIT=c758fa66f` and `DEPLOY_LANE=deploy-lane`.
- The container was created at 2026-11-25T16:22:42Z. That gives a log window of about 1.5 hours, ending
  at 17:54Z.
- `c758fa66f` is an ancestor of the reviewed `54459ca3ea`. There is **no diff** in `maiaService.ts` or
  `awareness-levels.ts` between them, so the reviewed code is the live code for these files.

**Counts** (numbers only; no log content or user identifiers left the host):

| Marker | Count |
|---|---|
| `[Policy] Level` | 0 |
| `[Awareness Adaptation]` FAST / CORE / regeneration | 0 / 0 / 0 |
| `FAST PATH: Simple response` (FAST turns entered) | 6 |
| `CORE PATH: Normal MAIA` (CORE turns entered) | 12 |
| `[Dialectical Scaffold]` | 36 |
| `DEBUG_CONSCIOUSNESS` | off |

**Attribution:**
- The zeros **do not show absence.** Both ladder log lines sit behind `DEBUG_CONSCIOUSNESS === '1'`,
  which is off, so they cannot fire in production. The instrument was not reconciled with the execution
  path.
- The adaptation itself (`adaptResponsePromptWithPolicy`) is unconditional whenever `policy` is non-null.
- `getConsciousnessPolicy` returns null when there is no user ID, no spiralogic profile row, or fewer
  than 20 beads (`maiaService.ts:491, 509, 521`).

**What is now established (runtime):** 18 production turns in the window entered the two functions that
call `getConsciousnessPolicy`. The ladder code is on the live path.

**What is not established:** how many of those 18 turns had a non-null policy, meaning the member had 20
or more beads and the ladder actually changed the prompt. Settling that needs either:
- (a) a count of members with ≥20 beads (a DB count; separate authorization), or
- (b) a non-content counter (separate authorization; this is a code change).

**DB count (counts only; founder-authorized in session, 2026-11-25; run in a `READ ONLY` transaction):**
- The app's `DATABASE_URL` resolves to `maia-postgres:5432/maia_consciousness`, the database queried.
  Credentials were redacted on the host.
- `bead_events` total rows: **0**.
- Members with any spiralogic bead in 30 days: **0**. Members at or over 20: **0**. Newest spiralogic
  bead: **none**.
- No writer of `bead_events` exists in `app/`, `lib/` or `scripts/` at `c758fa66f` (code-read). Only
  readers exist.

**P0-a verdict (runtime, as of 2026-11-25 ~18:00Z):** `getConsciousnessPolicy` returns null for every
member, because the 20-bead precondition cannot be met. **The awareness ladder is on the live path but
DORMANT. It has not shaped any production prompt in the current state.**
- **Re-ranked:** P0 → **P1 (latent).** The risk is silent activation. Anything that starts writing
  `bead_events.spiralogic_element` would switch the ladder on with no deploy and no log signal, since
  the logs are debug-gated.
- This strengthens the case for the refusal-16 extension (test P0-a.4): a guard that prevents the latent
  path from shaping responses if data ever appears. It does not require any urgent change.

**New DISCOVERED item: Dialectical Scaffold** (36 lines in the window, the only ladder-shaped marker
that fires).
- Code: `maiaService.ts:1456` logs "FAST path scaffolding injected: Level N → N+1" from `bloomDetection`.
- This is a cognitive-level detection (Bloom) that injects scaffolding toward the *next* level. It is
  **runtime-witnessed as firing** (count only); content was not read.
- Canon tension: `CONSTITUTIONAL_DIRECTION_OF_AUTHORITY.md` says MAIA "never moves a person through" the
  layers.
- Classification candidate: **C**, possibly **B**. It needs review before ranking. The count (36) exceeds
  the FAST-turn count (6), so it also fires on other paths or more than once per turn. Not traced.

## 5b. Dialectical Scaffold and the Bloom-gated Field Safety: read-only code review (live `c758fa66f`)

Founder-authorized ("Yes, review scaffold", 2026-11-25). Code-read only. No new production reads.

### What the code does

1. **Every turn is classified on Bloom's six levels.**
   - `getMaiaResponse` calls `detectBloomLevel(input, history)` (`lib/sovereign/maiaService.ts:3334`).
   - The detector is keyword/pattern scoring (`lib/consciousness/bloomCognition.ts:233-330`).
   - Empty input defaults to Level 2 *with* a scaffolding prompt (:241-249).
   - The production count of 36 `[Dialectical Scaffold]` lines is consistent with this per-turn detection
     log (:3349), plus injection logs.
2. **Covert steering is injected into the prompt.**
   - FAST (:1443-1457) and DEEP (:2574-2589) append the text: "User is currently at Bloom Level N … **Pull
     them toward Level N+1** … **Do NOT mention Bloom's Taxonomy explicitly.** The scaffolding should feel
     organic."
3. **Each turn's inferred level is persisted per member.**
   - `logCognitiveTurn` (:3365, :3389; `lib/consciousness/cognitiveEventsService.ts:66-101`) runs on
     `if (userId)` only.
   - It stores `bloom_level`, `bloom_score`, `bypassing_spiritual`, `bypassing_intellectual` and
     `scaffolding_prompt`.
   - No consent field and no Sanctuary check is visible in this block or in the service (code-read).
     Whether Sanctuary turns reach this block is **not established**.
4. **The persisted levels become a profile that can refuse MAIA's reply.**
   - `getCognitiveProfile` computes `rollingAverage`, `stability` and bypass frequencies
     (`cognitiveProfileService.ts:60-110`).
   - The main member route `app/api/sovereign/app/maia/route.ts:222-275`, and the `/list` route
     (:661-714), call `enforceFieldSafety` **on every request** whenever a profile exists. The call does
     not depend on what the member asked.
   - In `panconsciousFieldRouter.ts`, a **rolling Bloom average < 2.5 ⇒ `fieldWorkSafe = false`**. The
     route then **returns a "mythic boundary message" in place of MAIA's response** (status 200, "Not an
     error"). This also runs for guests.

### Classification

| Element | Class | Canon in tension |
|---|---|---|
| Socratic follow-up questions | **H**: keep. A genuinely good heuristic when *offered* | — |
| "Pull them toward Level N+1", "Do NOT mention", "should feel organic" | **B**: covert directional influence | Oath / non-manipulation vow; `CONSTITUTIONAL_DIRECTION_OF_AUTHORITY.md` (MAIA "never moves a person through"); Invariant 16 |
| Per-turn level, plus "spiritual/intellectual bypassing" flags persisted per member | **B**: inferred psychological state stored without provenance or consent | Growth-obligation law; refusal-16's principle (it lists only `relational_phase`/`autonomy_streak`); Sanctuary invariants *if* reached |
| Refusing MAIA's reply on a rolling inferred cognitive average | **B, highest**: access gated on an inferred cognitive rank | Sovereignty Invariants (MAIA not the authority on a person); `SOULLAB_LIVING_ORIENTATION_SYSTEM.md:234` (no ladder) |
| Bloom regex as a single level | **C**: premature closure | ECA/heuristic guidance |

**Protective intent acknowledged.** The gate's stated purpose is grounding before symbolic or field work,
which is a legitimate care concern. The defect is the mechanism: it is unconditional, keyed to a
regex-inferred rank, invisible to the member, and it refuses ordinary conversation, not only field work.

### Re-ranking

**This becomes the new P0 candidate, pending runtime evidence**, because it is on the live route and can
deny members MAIA altogether.

### Runtime evidence needed (not yet authorized)

- Counts only from production logs, as before: `[Field Safety] Blocked request` and
  `[Field Safety Guard] Blocked` (the second line includes a username, so count only and never export).
- Optionally, a DB count of rows in the cognitive events table, and of members whose rolling average is
  below 2.5. This is a separate authorization.

### Runtime evidence (counts only; founder-authorized, 2026-11-25 ~18:00Z)

- **Live binding:** live `c758fa66f`. The log window runs from 16:22:43Z to 17:59:54Z.

| Marker | Count |
|---|---|
| `[Field Safety] Blocked request` (route) | 0 |
| `[Field Safety Guard] Blocked` | 0 |
| `[Panconscious Field Router]` (all) | 0 |
| FAST turns / CORE turns | 6 / 12 |

- **Instrument check:** the router's log line is **not** debug-gated. It prints whenever
  `enforceFieldSafety` runs with a profile. The route calls it only when `getCognitiveProfile` returns
  non-null.
- So zero router lines means **no request in the window had a cognitive profile, and the gate did not
  fire.**
- **Established:** no member was blocked in this ~1.6 h window.
- **Not established:** whether any member *has* a profile, meaning prior cognitive-event rows that would
  trigger the gate on their next visit. The window is short, and a member with a profile may simply not
  have visited. Settling it requires a DB count of the cognitive events table, and of members whose
  rolling average is below 2.5 (separate authorization).
- **Ranking:** stays the **P0 candidate**. The mechanism is live-wired, and its dormancy is unproven
  beyond this window.

### DB count (counts only; founder-authorized; `READ ONLY` transaction, 2026-11-25 ~18:05Z)

**Raw counts:**
- `cognitive_turn_events` exists. Total rows: **0**. Distinct users: **0**. Rows in the last 7 days:
  **0**. Newest row: **none**.
- Members by the rolling average over their last 20 rows (same window as the code), in the bands
  <2.5 / 2.5–4 / ≥4: **0 / 0 / 0**.

**Verdict (runtime, current state):**
- `getCognitiveProfile` returns null for everyone, so **the Field Safety gate cannot block anyone today.**
- It is **DORMANT, not absent.**

**Unattributed anomaly (DISCOVERED):** 18 turns in today's window ran Bloom detection (36 log lines),
yet no rows were written.
- `logCognitiveTurn` is fire-and-forget and fail-open, so a write failure would be silent.
- Possible causes, none established:
  - a schema mismatch;
  - a null `userId` on those turns;
  - the table-existence gate.
- **Hold this observation rather than complete the story.**

**Consequence (same latent pattern as the awareness ladder):** if this write path starts succeeding,
whether by a schema fix, a migration or a refactor:
- the stored levels accumulate;
- the gate activates without a deploy of the gate itself;
- members averaging below 2.5 would start receiving a boundary message in place of MAIA.

**Ranking:**
- **P0 latent.** No current harm is witnessed. The highest-consequence silent activation is in this
  plan.
- **Pre-activation guard recommended:** the gate is limited to requested field or symbolic work (test 1
  below) *before* anyone repairs the writer.
- **Covert steering:** "Pull them toward Level N+1 … Do NOT mention" is **live now.** The detection log
  fires per turn, and the injection runs whenever `scaffoldingPrompt` is present, which the detector
  always sets. Of the items here, **this is the one with present-tense member contact.**

### Behavioral tests (proposed)

1. A member whose stored history averages below 2.5 sends "I'm having a hard day" and receives a MAIA
   response, not a boundary message. Field-work gating applies only when field or symbolic work is
   requested.
2. No system prompt contains "Pull them toward Level", or any instruction to conceal a steering intent.
3. Socratic questions appear as offers ("would it help to…") and never as covert redirection.
4. A Sanctuary turn writes zero rows to the cognitive events table.
5. The refusal-16 guard is extended to `bloom_level`, `rollingAverage` and the bypass flags.

## 6. Not established

- Any runtime behavior.
- Owner routing per lane.
- Full callers of the element bridge.
- Liveness of `BardicAgent`.
- Whether production `maia_turns` or `teloi` hold rows.
