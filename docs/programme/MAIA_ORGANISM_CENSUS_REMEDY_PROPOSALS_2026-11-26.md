# MAIA organism census: remedy proposals for founder approval (2026-11-26)

**Owner:** `MAIA-ORGANISM-CENSUS-01`, under SOULLAB-CONTINUITY-01 (#1982).
**Extends:** the reconciliation addendum in PR #2421.
**Prompted by:** a consolidated handoff the founder pasted into this session on 2026-11-26. It was written by another assistant and asked
for items 1–7 to be "prepared for founder approval… before execution". Its recommendations are recorded here as **proposals**.
They are **not** rulings.
**Read at:** canonical `clean-main-no-secrets` @ `448f66e92`. Code-read only, plus a read of GitHub checks.
**Standing:** a proposal record. It authorizes no code change, environment change, production read, database query, deploy
or merge. Every item below states the founder act it needs.

## 0 · Founder questions (each asked once, with a recommended ruling)

| # | Question of principle | Recommended ruling |
|---|---|---|
| Q1 | When a recognized member has made **no** retention choice (no opt-in surface exists for formation), should MAIA form long-term memory (patterns, developmental memories, breakthroughs) from their turns? | **No, not until the member chooses it.** Form only what the member's resolved mode permits. First run trace T1 (§6), so that the size of the experiential change is known before the ruling takes effect. |
| Q2 | ADR-012 (open since 2026-07-07, ruling reserved for Kelly): may production MAIA send member text to OpenAI for speech? | **No.** Production speech goes only through qualified local providers. If they fail, the turn degrades to text or browser speech, never to silent cloud egress. |
| Q3 | Should onboarding copy name the underlying language model? | **Yes, plainly.** See the wording in §3, which is offered as an input to the claim review in #2422. |

The other items (§1, §4, §5, §6) follow from instruments that already exist and need a go-ahead, not a ruling.

## 1 · PR #2421: admission as Class C records

- Head `0b915bec5`. **11 of 11 checks pass**: covenant-gates, sovereignty, build, TypeScript no-regression, and 7 others.
  They are GitHub Actions check-runs. The combined-status endpoint does not report these, which explains why the pasted handoff found
  "no checks" there.
- GitHub reports it MERGEABLE. It is behind canonical, with no conflict; a conflict with #2423 in `PRIORITY_THREAD_LOG.md`
  was resolved earlier by keeping both entries. It is still a draft and changes two docs files (+114 / −0).
- **Founder act:** mark it ready and merge it, or rule otherwise.

## 2 · Class A remedy proposals

### 2a · X4: memory formation ignores the member's mode

**Evidence (code-read, `448f66e92`):**

| Fact | Site |
|---|---|
| Anonymous visitors get `requestedMode = 'ephemeral'` | `app/api/sovereign/app/maia/list/route.ts:741` |
| Anonymous visitors still get a writeback identity, their session id | `list/route.ts:731` (`effectiveUserId = isRecognizedUser ? userId : session.id`) |
| The server resolves the mode, permitting `longterm` only when `MAIA_LONGTERM_WRITEBACK=1` and the allowlist allow it | `lib/memory/MemoryGate.ts:50-85` |
| The writeback ignores the resolved mode and passes the literal `'longterm'` | `list/route.ts:2036`. This dates from `6b83cffde` (2026-04-02) |
| The writeback's own gate (ephemeral: no writes; continuity: no promotion) is therefore never reached | `lib/memory/MemoryWriteback.ts:333-342` |
| The anamnesis write (`relationship_essences`) is gated only on `!isSanctuary` | `list/route.ts:1985` |
| The client sends `longterm` only if a hidden localStorage key is set, so there is no member-facing choice | `components/OracleConversation.tsx:5736` |
| The member consent toggles govern **recall** only, never **formation** | `components/settings/MemoryConsentSection.tsx:6-12`; `list/route.ts:1363,1391` |

**Finding, stronger than recorded:** every non-Sanctuary turn reaches the full long-term pipeline. That includes **anonymous visitors**,
whose turns are keyed to their session id. This bypasses the member's choice, and it also bypasses the server's own env-and-allowlist gate.
Members are told "only with your consent. You control what she holds" (`components/onboarding/FAQSection.tsx:37`). Today the
code does not honour that sentence.

**Proposed change (the smallest reversible unit):**
1. Anonymous visitors (implementable without a ruling, because "no stealth memory" already settles it): skip writeback and anamnesis
   when `!isRecognizedUser`.
2. Recognized members (needs Q1): replace the literal at `:2036` with the resolved `memoryMode`.
3. Anamnesis at `:1985` (needs Q1): gate it on the same resolved mode.

**Experiential consequence, to be weighed before Q1 takes effect:** if production does not set `MAIA_LONGTERM_WRITEBACK=1`, step 2
stops new long-term memory formation for every member. Existing memories stay. Members who have come to expect MAIA to
notice patterns would meet a quieter MAIA. Trace T1 settles this. The honest end state also needs a member-facing
formation choice, which is a separate design act.

**Acceptance gates:**
- Unit tests: anonymous visitors produce no writeback call; a continuity member reaches no promotion; an opted-in longterm member
  is unchanged; Sanctuary is unchanged.
- A refusal falsifier at the next free registry number, which fails if a literal `memoryMode: 'longterm'` reappears at a writeback call site.
- `verify-constitution-colab.ts` reports 0 failed (memory atoms are a Co-Lab trigger).
- `npm run typecheck` shows no regression.
- **Device witness** that a founder-controlled member's memory behaviour matches their mode.

### 2b · X6: OpenAI speech outside the R15 funnel

This is **already an open founder question**: `docs/adr/012-openai-tts-production-status.md` (2026-07-07). It says: "Decision: None.
The archetype→OpenAI question is deferred." The ruling belongs in ADR-012. This record creates no new instrument.

**Evidence (code-read):**
- R15 guards only `lib/tts/ttsRouter.ts` (`assertProviderQualified`). The route `app/api/voice/openai-tts/route.ts` calls
  `getOpenAI().audio.speech.create` directly, on two paths. The archetype path is at `:130-150`. The fallback path, used when Kokoro
  fails, is at `:298-312`. **R15 passes while this egress exists.**
- Every `maia_*` archetype, including the default `maia_core`, resolves to OpenAI unless `MAIA_VOICE_OVERRIDE=kokoro`
  (`lib/voice/voiceArchetypes.ts:58-59,67-72`).
- The project anchor says "Never use OpenAI or other cloud AI providers" and "Voice: Local TTS/STT or browser APIs only".

**Proposed change, if Q2 is ruled "No":**
1. Route both OpenAI paths through `assertProviderQualified`, so that `production-maia` refuses them at a single funnel.
2. On local failure, return a typed error the client renders as text or browser speech.
3. Set `MAIA_VOICE_OVERRIDE=kokoro` in production. This is a separately authorized production change, reversible by restarting the
   container.

**Experiential consequence:** MAIA's voice changes. Alloy becomes `af_kore`, and Shimmer and Nova become `af_sarah` and `af_nicole`.
Whether Kokoro is running and healthy on minisforum is UNKNOWN; trace T1 or T2 establishes it.

**Acceptance gates:**
- R15 extended to the route, with a falsifier: no `audio.speech.create` reachable in `production-maia` without the guard.
- Tests for both paths.
- A device witness of the new voice, heard by the founder, before cutover is accepted.

## 3 · FAQ: "MAIA is not an LLM" (Q3)

The claim appears **twice**: `components/onboarding/FAQSection.tsx:37` (markdown source) and `:440` (rendered JSX). Both must change
together. The same passage also makes claims that need the same review: the PFI table, "three decades of research", the claim that
intelligence "emerges from field dynamics", and the consent sentence that X4 contradicts.

Wording offered to the #2422 claim review (proposal):

> **MAIA is more than a language model.** Her conversation runs on large language models (primarily Anthropic's Claude, with a local
> model as fallback), and Soullab's relational and developmental architecture governs how she uses them: what she attends to, what
> she may remember, and what she must never do. Her purpose is not to generate answers but to support your understanding,
> creativity, relationships and becoming, while honouring your sovereignty, privacy and freedom to choose.

This names the model, as Q3 recommends. The handoff's version ("language models are among the technologies it draws upon") is
accurate but understates how central the models are. **Ship the consent sentence only after X4 is fixed.**

## 4 · Page 12: status headers only

Keep both documents. Add one status line at the top of each, and make no other edit:
- `12_house_onboarding_2026-09-06.md` gets: *HISTORICAL CENSUS RECORD: observed 2026-09-06 at `cf6d9ebf`; line numbers may have drifted.*
- `12_house_onboarding.md` gets: *PROPOSED DESIGN: written 2026-10-30 (PR #2011); not a census observation.*

Which of the two the map index points to stays the founder's call.
**Gate:** the diff contains only these two header lines.

## 5 · E1 correction shadow: re-admission assessment

Read-only, from canonical `448f66e92` against deploy branch `0780f368f` (merge base `ca5fdff44`).

| File | E1 change | Against canonical |
|---|---|---|
| `lib/maia/canonical-turn/correctionShadow.ts` | +117 | applies cleanly |
| `lib/maia/canonical-turn/__tests__/correctionShadow.test.ts` | +98 | applies cleanly |
| `tests/constitutional/refusal-registry/refusal-32-correction-shadow-observational.ts` | +75 | applies cleanly, but **the number collides** |
| `app/api/sovereign/app/maia/list/route.ts` | +34 | **conflicts** (canonical +376/−61 since the merge base). The anchors E1 uses still exist |
| `tests/constitutional/refusal-registry/index.ts` | +2/−1 | **conflicts** |
| `docs/programme/E1_CORRECTION_SHADOW_SPEC_2026-09-06.md` | +63 | **add/add conflict**. Keep canonical's 88-line version (status line 6: "BUILT · GATED · UNDEPLOYED · UNWITNESSED") |

**Collision.** Canonical's registry runs R01–R32, with no R12. R32 is `no-covert-developmental-steering`, and renumbering it is refused
in `700b6d5247`. **R33 is the next free number.** Taking it means updating the falsifier file and spec lines 23, 31, 69 and 86.

**What E1 is.** It is observational only. It writes one log line (`[MAIA/shadow] correction-candidate`) containing a member reference,
class, markers and turn index, and no member text. It needs no database or migration. It is gated off for Sanctuary twice (route and
module), can be switched off with `MAIA_CORRECTION_SHADOW=0`, makes no model or network call, and runs after the reply with no reader.
Canonical has nothing overlapping it. Canonical's `adjudicate.ts` is participation adjudication, not correction.

**Honesty about scope.** E1 lets the programme *know when MAIA was told she is wrong*. It does **not** make MAIA change her
understanding. Corrigibility, in the sense the handoff describes, comes later in Plane B and is not built anywhere.

**Proposed lane:**
1. Renumber to R33.
2. Resolve the three conflicts by hand.
3. Re-run R30 first; the spec records R30 failing before E1 existed, and its status today is UNKNOWN.
4. Run the tests and get independent review.
5. Deploy through `prepare-maia` and then `cutover-maia`, each under its own authorization.
6. **Witness:** the log marker appears for a founder-controlled correction turn, and the reply is unchanged.

The pp-2 refactor on the census branch (about +372/−537 across 12 files) is a **separate** lane and is not part of E1.

## 6 · Reach traces: a bounded read-only plan

Each trace needs its own go-ahead, and none reads member content.

| Trace | What it reads | Settles |
|---|---|---|
| T1 · production env | Whether `MAIA_LONGTERM_WRITEBACK`, `MAIA_VOICE_OVERRIDE`, `MAIA_TTS_PROVIDER`, `MAIA_LOCAL_VOICE_ENABLED` and `MAIA_CORRECTION_SHADOW` are present, and their values. For `OPENAI_API_KEY`: presence only. For the allowlist: its length only, never its ids | Q1's consequence; whether the OpenAI voice is live |
| T2 · log counts | Counts only, over N days, from `maia-sovereign` logs: `ARCHETYPE provider=openai`, `FALLBACK`, Kokoro synthesis, and `Sovereign/Writeback] Memory formed`. No lines are exported | Real egress volume; how often memory forms |
| T3 · anonymous memory rows | One aggregate count: `developmental_memories` rows whose `user_id` matches no `members.id`. Needs **explicit database authorization** | Whether X4's anonymous leak has happened in production |
| T4 · X17 reach | A static import graph from the nudge, rupture and companion modules to mounted pages | Whether that copy can reach a member |

**Excluded:** synthetic turns in production. Under X4 they would themselves form memory. Synthetic tests run on the Mac Studio stack.

## 7 · Not taken in this lane

- **Handoff item 7 (JARVIS benchmark Phase 2)** and its two governance questions: whether the benchmark ran under the credential-free
  execution identity, and the approval provenance of #2426. These belong to the JARVIS-AIO-01 owner (#1974), not this census.
- **The handoff's P0–P3 ordering** is recorded as a proposal. It agrees with September's Plane B order (E1 first).
