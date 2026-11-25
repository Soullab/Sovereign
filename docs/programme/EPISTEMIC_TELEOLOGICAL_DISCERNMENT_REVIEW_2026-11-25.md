# Philosophical Ontology, Epistemic Discernment & Teleology Review — 2026-11-25

**Standing:** READ-ONLY review. Working note, admitted as a record by founder ruling ("Yes, docs PR", 2026-11-25); admission is custody, not ratification. Authorizes nothing. Superseding runtime evidence is in `CODE_TO_CANON_RECONCILIATION_PLAN_2026-11-25.md` §5a–§5b (P3 stage-naming finding corrected there).
**Mandate:** Founder "Yes, read-only review" (in session, 2026-11-25), on the conversational proposals
"Elemental Relational Realism" and "Open Relational Teleology" (neither ratified).
**Bound ref:** `origin/clean-main-no-secrets` @ `54459ca3ea` (includes the census merge, PR 2409).
Local checkout (`fix/pro-soul-portrait-open-existing` @ `6159b37de4`, 39 dirty files) was **not** read.
**Evidence class:** everything below is *doc-read* or *code-read* at that SHA. **Nothing here is runtime
evidence.** "Code says X" ≠ "production does X". Liveness of every code path below is UNVERIFIED.
**Method:** three read-only readers plus direct spot-checks. ✔ = I re-read the cited lines myself.
**Continuity:** SoullabTech/Sovereign#1982 is open and active (486 comments, last 2026-11-25 16:46Z).
The proposals' "empty record" was their tool's fetch failure.

---

## 0. Headline

The proposals are **largely already canon** (sovereignty, no destination, no ladder, growth > engagement,
no collapse of possibilities). The gap is **not philosophy — it is code that contradicts ratified canon.**
The recommended move is therefore *not* a new doctrine, but a canon-vs-code reconciliation, routed to
existing owners.

## 1. What already stands in canon (do not rebuild)

| Proposed principle | Existing instrument | Custody |
|---|---|---|
| Human sovereignty over algorithmic interpretation | `MAIA_SOVEREIGNTY_INVARIANTS.md:35` "not the final authority on a person's life direction" | Constitutional (sealed) |
| Purpose without prescription / no destination | `MAIA_CANON_v1.1.md:119-125` "No defining where users 'should' arrive" ✔ ("Fidelity is not teleological", :125) | Canon |
| Development without imposed hierarchy | `SOULLAB_LIVING_ORIENTATION_SYSTEM.md:234` "must not become a rigid ladder"; `SPIRAL_CONTINUITY_ENGINE.md:125` | Canon (founder 2026-09-26) |
| No single perspective holds the whole | `CHANGES_SECTION_EPISTEMIC_DISCIPLINE.md:25,29` (no pseudo-convergence / collapsing possibilities) | Canon |
| Growth > engagement; no prediction-personalization | Invariants 3, 4, 15, 16 (`MAIA_SOVEREIGNTY_INVARIANTS.md:69,90-105,287,307`) | Constitutional |
| Frameworks are lineages, not universal | Invariant 14 (`:262-272`) | Constitutional |
| Distinguish evidence / experience / inference / symbol | ECA-00 four epistemic classes (`ECA-00.md:357-377`); epistemic-join `Jurisdiction`/`ComponentKind` (`lib/ain/epistemic-join/types.ts:102-204`); canonical-turn 3-axis provenance (`participationDisposition.ts:17-70`) | Canon doc (frozen) + code (shadow / default-OFF) |
| Member authoritative over own meaning | `MEMBER_AUTHORITATIVE_KINDS` (`types.ts:210-216`); `MAIA_PROPOSED` | Code, M1 / no live caller |

**Not found in canon:** a named realist epistemology; "experience is legitimate *but not infallible*"
(only the first half is stated); any axiology document ("axiolog" = 0 hits); any "context graph"
(0 hits repo-wide ✔ — the proposal's term has no referent here).

**Tension to resolve before naming:** Canon v1.1 states "Fidelity is not teleological." Adopting the
label "Open Relational Teleology" would read as contradicting ratified canon unless framed as
*direction without destination*, which the canon already holds. Recommend not introducing the word
"teleology" as doctrine; the substance is already ratified.

## 2. Code that contradicts ratified canon (DISCOVERED — report only, not homework)

Ranked by member-facing risk. All code-read; reachability/liveness UNVERIFIED unless stated.

1. **Developmental ladder shapes MAIA's responses.** ✔ `lib/consciousness/awareness-levels.ts:7-13,72-126`
   defines 7 levels "Newcomer … Master (transcending frameworks)"; `inferAwarenessLevel` (:226) ranks members
   by bead count / Aether share / balance; `lib/sovereign/maiaService.ts:533-558` feeds it into
   `createConsciousnessPolicy`. Contradicts `SOULLAB_LIVING_ORIENTATION_SYSTEM.md:234`,
   `SPIRAL_CONTINUITY_ENGINE.md:125`, Invariant 14.
   ✔ **The existing guard does not cover it:** refusal-16 guards only `relational_phase` / `autonomy_streak`
   (`refusal-16-…-guard.ts:52-83`); `inferAwarenessLevel` is outside its scope. Refusal-16 also is not wired
   into any CI workflow (runs via local `check:refusals` only).
2. **Inferred telos stored about members without provenance or consent fields.** ✔
   `database/migrations/20251230000004_teleology.sql:11-30` — `teloi(user_id, phrase, strength, horizon,
   signals)`; no author / "MAIA-inferred" / consent column. Phrase produced by LLM extraction
   (`lib/memory/bardic/TeleologyService.ts:295-320`). Conflicts with the growth-obligation law
   (capability ⇒ matching provenance) and Invariant 16. `extractTeloi` has no found caller; `checkBalance`
   is called (`ConversationMemoryIntegration.ts:343`). Wiring unverified.
3. **Engagement-weighted "effectiveness".** ✔ `lib/memory/SemanticMemoryService.ts:686-694` scores
   observations by engagement, `sessionContinued` (+0.1), breakthrough; stores `engagement_score`,
   `session_length_after` (:146-149). Contradicts Invariant 4. Note: constructor gates on
   `NEXT_PUBLIC_DATABASE_URL` + `DATABASE_SERVICE_KEY` (Supabase-era shape) — may be dormant; unverified.
4. **Streaks.** ✔ `lib/bardic/blessing-moments.ts:148-175` (streak milestones, exported via
   `lib/bardic/index.ts`); `lib/analytics/ElementalAlchemyAnalytics.ts:164,499` (`dailyAlchemyStreak`).
   Contradicts `RIGHT_TO_REMAIN_UNPOSSESSED.md:193`, `SPIRAL_CONTINUITY_ENGINE.md:179`.
5. **Prompt instructs naming stages.** `lib/consciousness/epistemicPathPrompt.ts:58` (Integral path):
   "Name levels/stages/states when helpful." Contradicts the same canon as #1.
6. **Elements as single-label classifier, not modes.** Doc (ECA-00) treats elements as processes and forbids
   "You are Fire". Code: regex keyword argmax with archetype labels and a sixth `shadow` class, default
   `earth` (`lib/bridges/elemental-oracle-bridge.ts:333-385`); `normalizeElement` → 'Earth' on unknown
   (`pfiMindEntrypoint.ts:220-237`). No ambiguity modelling; uncertainty collapsed.
7. **"Unified Field" restates its input.** ✔ `lib/field/fieldOrchestrator.ts:265-285` sets input element
   0.8, others 0.2, fallback 'earth'; ~30 stub values (`:287-318`) enter as unmarked "readings"; JSON
   appended to the system prompt (`:383-390`), called on FAST path (`maiaService.ts:1711-1724`). Two
   internal docs call Unified "orphaned" — **docs and code disagree; runtime unknown.**
8. **No single element taxonomy.** 89 files declare element literals: 4 vs 5 elements, casing, extra
   `spiralogic`/`shadow`, aether/ether/spirit folded. Aether treated as a fifth peer, contrary to ECA-00
   Fifth-Field Law (`ECA-00.md:79-95`).
9. **Normative endpoint in field calculator.** `UnifiedElementalFieldCalculator.ts:323-333,406-417`
   ("Breakthrough Imminent", "Unity Consciousness Active", argmax dominant element, evolution vector) —
   unity/balance/Aether as the implied goal.

## 3. Answers to the review's questions (short form)

1. **Assumptions about reality.** Canon: participatory, plural, person-authoritative. Field and element
   code: reality as measurable scalars ("bioelectricity", "unityConsciousness") about the person.
2. **Forms of knowledge recognized.** Strong where the epistemic join and canonical turn reach
   (jurisdiction, authorship, inference held apart). Absent in the field and element layers.
3. **Evidence / experience / inference / symbol.** Distinguished in the canonical turn (shadow) and the
   epistemic join (default-OFF). Not distinguished in teloi, the field layer or the element bridge.
4. **Uncertainty and competing interpretations.** Preserved in the join (PROVISIONAL caps), the tagger
   (confidence, offered/rejected status, 7-day re-offer gate) and the turn (HELD with reasons). Collapsed
   in elements (argmax) and the field layer (fixed confidence 0.8).
5. **Translation into response.** Tone kernels and "ask before interpreting" consent gates are good. The
   field addendum injects raw scalars into the prompt.
6. **Teleology / axiology.** Canon already has the right teleology (Mission Anchor: aliveness, agency,
   relational capacity; no destination). Code has a ladder, an unconsented telos store, engagement scoring
   and streaks.

## 4. On the proposals' 7-stance discernment table

Existing taxonomies cover empirical (≈ `scientific_evidence`), phenomenological (≈ `member_lived_account`)
and symbolic (≈ `symbolic_correspondence`, `practitioner_interpretation`). Missing as named categories:
exploratory/intuitive (closest is `HYPOTHESIZE`), participatory/contemplative, developmental/pragmatic.
The existing schemes are organized by **authorship and jurisdiction**, which is the stronger axis for
sovereignty. If stances are added, recommend them as a **mapping onto the epistemic-join jurisdiction
axis**, not as a new classifier (one canonical axis — the finding from turn 1). Any such addition is a
new classification and touches ECA-00's freeze terms ("introduce new elemental classifications" is
barred), so it needs a ruling.

## 5. Bars respected

- ECA-00 frozen (blob `3ceb9863…`, `9bb3a9744`); the freeze bars operationalizing Weather, new elemental
  classifications or altering MAIA (`…ADJUDICATION_AND_FREEZE_2026-11-15.md:107-122`). Not reopened.
- Sealed or ratified: Canon v1.1, Oath, Sovereignty Invariants, Constitutional Direction of Authority,
  Living Orientation System, Representation Authority Law, Optimization Tooling Governance. Not reopened.

## 6. Custody anomaly

The global JARVIS Core names `docs/governance/JARVIS_STEWARDSHIP_CONSTITUTION_2026-08-12.md` and
`…FOUNDER_ESCALATION_CONTRACT_2026-08-12.md`. ✔ **Neither exists at `54459ca3ea`** (no tree match). They may
live on another branch or under another name; not established. Reports that cite them should not assume
they stand on the default branch.

## 7. Not done / limits

- No runtime trace of any path above (FAST-path liveness, `extractTeloi` callers, SemanticMemoryService
  enablement, streak UI reachability). These are the evidence needed before any claim stronger than
  "code says".
- Not read in full: the canonical-turn spec and census, `MAIA_EPISTEMIC_TONE_SPEC_v1.0.md`,
  `lib/provenance/*`, the 139 unified-field hits, and the McGilchrist / Whitehead / Varela / individuation
  hits (counted only).
- No PRIORITY_THREAD_LOG lane check for which owner holds the field/element, memory and bardic code.

## 8. Item states

| Item | State |
|---|---|
| Elemental Relational Realism / Open Relational Teleology as doctrine | PROPOSED (not ratified; largely covered by existing canon) |
| 7-stance discernment as a new taxonomy | RULING_REQUIRED (touches ECA-00 freeze terms) |
| §2 items 1–9 (code vs canon) | DISCOVERED (routing to existing owners is the founder's call) |
| Stewardship constitution location | DISCOVERED (custody ambiguous) |
