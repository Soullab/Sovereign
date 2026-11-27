# MAIA organism census — founder rulings, trace results and Class A plans (2026-11-26)

**Owner:** `MAIA-ORGANISM-CENSUS-01` under SOULLAB-CONTINUITY-01 (#1982).
**Answers:** Q1–Q3 of the remedy-proposals record (`MAIA_ORGANISM_CENSUS_REMEDY_PROPOSALS_2026-11-26.md`, #2430).
**Authority:** a founder direction issued in session on 2026-11-26. The text was drafted by another assistant and **pasted in by Kelly**;
§1 quotes it. Its own closing note says it is "recommended founder direction, not a recorded authorization". Kelly's act of
issuing it in session is the authorization recorded here, and **this record is where it is recorded**.
**Standing:** records the rulings, the read-only trace results and the remedy *plans*. ⛔ It authorizes no code change, production
configuration change, migration, deploy or database read. The Class A plans in §4 are for review; implementing each one is its own act.

## 1 · The rulings (quoted)

| # | Ruling |
|---|---|
| PRs | "PRs #2421 and #2430: Approve records-only merges in that order, subject to current exact-diff and CI verification. Admission of a proposal record does not authorize its implementation." |
| Q1 · memory | "MAIA must honor the member's resolved memory mode. Anonymous encounters must not silently form durable personal memories. Recognized members must be able to establish, understand, modify and withdraw their retention preferences. Preserve the distinction between ephemeral understanding, contextual continuity and long-term developmental memory. Preserve Sanctuary and existing revocation protections. Do not erase existing memories or silently reactivate dormant ones." Rationale: "Our objective is not less relational intelligence. It is relational intelligence grounded in sovereignty." |
| Q2 · speech | "Do not authorize production OpenAI speech outside the governed provider interface. Record the ruling in ADR-012. Maintain local-first processing and qualify all fallback mechanisms." Now recorded in `docs/adr/012-openai-tts-production-status.md`. |
| Q3 · public language | "Clearly acknowledge the underlying language models while distinguishing MAIA's relational identity, Soullab's developing intelligence architecture and our philosophical purpose. Route wording through #2422. Make no unsupported claims." |
| Evidence | "Approve bounded read-only traces T1, T2 and T4. Do not export credentials, member identifiers, conversation content or raw logs. T3 database access remains separately held." |
| Bound | "No production configuration change, migration or deployment is authorized." |

**Q1's three modes** (from the direction), and what each maps to in code:

| Mode in the ruling | Capacity | Code value |
|---|---|---|
| Ephemeral | Presence and understanding within the encounter, without durable personal memory | `'ephemeral'` |
| Continuity | Contextual continuity within the member's authorized scope | `'continuity'` |
| Developmental | Explicitly authorized long-term relational and developmental memory | `'longterm'` |

**Q3 wording offered to #2422** (from the direction, for Heather's claim review; not yet approved copy):

> **What is MAIA?** MAIA is Soullab's relational intelligence, designed to accompany people in their understanding, creativity,
> relationships and becoming. Her conversations currently draw on large language models, primarily Anthropic's Claude, alongside
> Soullab's own developing architecture of contextual, relational, developmental and elemental intelligence. Our purpose is to bring
> these technologies into service of human understanding, autonomy and meaningful connection.

## 2 · PR admissions

- **#2421** (census reconciliation addendum): verified at the time of the ruling: head `0b915bec5`, 2 docs files (+114/−0), 11/11 checks, no
  conflicts. A provenance comment was posted on the PR naming the session as the merging actor, because the `Soullab` GitHub account is shared.
- **#2430** (remedy proposals): one docs file (+175/−0). Covenant Gates first failed because the classification box did not match the template
  format; it was corrected to the template's Class C line.
- Merge outcomes are in the priority-log entry and on the PRs themselves.

## 3 · Read-only traces (2026-11-26, production `maia-sovereign` @ `653a24b49`)

**T1 · Production configuration** (presence/value of named flags only; the API key is presence only; the allowlist is counted, not listed):

| Flag | Value | Meaning |
|---|---|---|
| `MAIA_LONGTERM_WRITEBACK` | `1` | Long-term writeback is enabled server-side |
| `MAIA_LONGTERM_WRITEBACK_ALLOWLIST` | 0 entries | No allowlist, so **every** user is longterm-permitted (`MemoryGate.ts`) |
| `MAIA_VOICE_OVERRIDE` | unset | Every `maia_*` archetype, including the default `maia_core`, resolves to **OpenAI** |
| `MAIA_TTS_PROVIDER` | `kokoro` | Kokoro archetypes try local speech first |
| `MAIA_LOCAL_VOICE_ENABLED` | `1` | — |
| `OPENAI_API_KEY` | present | The OpenAI path is live, not dead code |
| `MAIA_CORRECTION_SHADOW` | unset | (E1 is not on canonical in any case) |
| `MAIA_DEPLOYMENT_CONTEXT` | unset | R15 fails closed to `production-maia` |
| containers | `maia-kokoro-tts` Up 3 months (healthy); `maia-whisper` Up 5 months (healthy) | Kokoro is running |

**T2 · Log counts.** Counts only; no line was exported. ⚠ The window is short: the logs only reach back to the container's creation at 2026-11-26 15:01Z
(1,309 lines, about 11 h).

| Marker | Count |
|---|---|
| `ARCHETYPE provider=openai` (member speech sent to OpenAI) | 2 |
| `pfi.tts.no_voice_plan` (speech without a VoicePlan) | 2 |
| OpenAI `FALLBACK` after a local failure | 0 |
| Kokoro archetype synthesis | 0 |
| `[Sovereign/Writeback] Memory formed` | 2 |
| Writeback skipped (any reason) | 0 |
| Anonymous sessions | 0 |
| Sanctuary skip | 0 |

The volume is too small to give rates. It **confirms that both paths are live in production**: member speech went to OpenAI, and long-term memory
formed. Nothing was skipped in the window.

**T4 · X17 static reach** (import graph from `app/` routes and pages; code-read at `d7743f819`):

| Copy | Reach |
|---|---|
| Rupture repair: default line "I can feel something went sideways there. I missed you, and I'm sorry for how that landed…" (`lib/consultation/rupture-repair-service.ts:106`) | **REACHABLE.** `/api/between/chat` calls `enhanceResponseIfRuptureDetected` (`app/api/between/chat/route.ts:1414`, `:2210`) when a rupture is detected. In context "missed you" reads as "missed what you meant", which is milder than the September reading. Whether members' turns reach `/between` in production is UNKNOWN; `/maia` uses `/list`. |
| Nudge "No rush, I'm here for you." (`lib/voice/NudgeSystem.ts`) | **Not reachable** from any `app/` route or page (8 transitive importers, 0 entry points) |
| `companion` archetype (`lib/consciousness/ArchetypalConstellation.ts`) | **Not reachable** from any `app/` route or page (31 transitive importers, 0 entry points) |

The method uses basename-matched imports, so it may over-include; chains were verified by hand only for rupture. **T3 is still held.**

## 4 · Class A remedy plans (for review; not authorized for implementation)

### 4a · X4 — memory formation honours the member's mode

**What T1 changes.** Longterm is permitted for everyone server-side, but the client requests `continuity` unless a hidden localStorage key is
set (`components/OracleConversation.tsx:5736`). So the naïve fix (pass the resolved mode at `list/route.ts:2036`) would **stop new
developmental memory for nearly every member at once**. Q1's rationale ("not less relational intelligence") rules that out unless a
preference surface ships with it. The plan therefore ships in two stages:

**Stage A — anonymous visitors (smallest unit, separable):**
- In `app/api/sovereign/app/maia/list/route.ts`, gate the writeback (`:2025`) and the anamnesis write (`:1985`) on `isRecognizedUser`.
- Tests: an anonymous visitor makes no `MemoryWritebackService.writeBack` call and no `relationship_essences` write; recognized and Sanctuary
  behaviour are unchanged.
- No change for members. Production evidence of anonymous formation awaits T3 (held). T2 saw 0 anonymous sessions in its window.

**Stage B — member-governed formation (ships as one unit):**
1. **Store the preference server-side.** Extend the existing consent endpoint `/api/members/recall-preferences` and
   `components/settings/MemoryConsentSection.tsx` with a *formation* choice: ephemeral, continuity or developmental, in plain language,
   changeable and withdrawable. This reuses the existing consent surface; it is not a parallel one. It needs a migration, which is a separate Class B review.
2. **Resolve server-side.** In `list/route.ts:741`, read the stored preference instead of trusting `meta.memoryMode` from localStorage, and keep `resolveMemoryMode` as the
   gate.
3. **Honour it.** Pass the resolved `memoryMode` at `:2036` and gate anamnesis on it.
4. **Respect the existing memories.** Nothing is deleted. Memories formed earlier stay subject to the existing revocation and recall toggles. A member who
   chooses continuity does not have dormant developmental memories silently reactivated or silently deepened.
5. **Acceptance gates:**
   - unit tests per mode;
   - a refusal falsifier at the next free registry number (literal `memoryMode: 'longterm'` at a writeback call site fails);
   - `verify-constitution-colab.ts` 0 failed;
   - `npm run typecheck` no regression;
   - independent review;
   - a **device witness** with a founder-controlled member in each mode.

**⚠ One question Q1 does not settle (two competent implementers would differ):** what formation mode applies to an existing member
**who has not yet chosen** once Stage B ships? Options: (a) continuity until they choose, which quietens MAIA for everyone at once; (b) developmental
until they choose, with a single clear notice, which preserves today's experience but stays on formation the member never chose;
(c) a one-time, non-interrupting invitation at their next session, with continuity as the default until they answer. **Recommended: (c).** It honours
"must be able to establish" without silent formation, and it does not make consent "a constant interruption".

### 4b · X6 — speech only through the governed interface

**Order matters.** The ruling requires Kokoro to be qualified **before** production changes, and browser speech is not to be assumed private.

1. **Qualify the voices.** The founder listens to the Kokoro equivalents (`af_kore`, `af_sarah`, `af_nicole`, `af_heart`, `af_bella`, `am_adam`)
   on the Mac Studio stack, against the current OpenAI voices. This is a member-experience gate, and Kelly is the witness. T1 shows Kokoro healthy in production.
2. **Close the bypass in code.** In `app/api/voice/openai-tts/route.ts`, route both OpenAI paths, the archetype path (`:130-150`) and the fallback
   (`:298-312`), through the R15 funnel (`ttsRouter.assertProviderQualified`), so that `production-maia` refuses them with
   `ProviderNotQualifiedError`. The lab (`voice-quality-lab`) is unchanged.
3. **Fallback.** When local speech fails, return a typed error; the client then shows the reply as **text only**. Browser speech stays off until it is
   separately qualified, per the ruling.
4. **Configuration.** Set `MAIA_VOICE_OVERRIDE=kokoro` in production. This is a **separately authorized production change**, reversible with a container restart,
   and it comes after step 1.
5. **Acceptance gates:**
   - R15 extended with a falsifier: no `audio.speech.create` is reachable in `production-maia` without the guard;
   - tests for both paths and the text-only fallback;
   - typecheck no regression;
   - independent review;
   - after cutover, T2 again: `ARCHETYPE provider=openai` = 0;
   - a device witness that the voice is acceptable.
6. Callers (13 files reference the route, including `OracleConversation.tsx`, Writers Studio `MaiaListen.tsx` and `AskMaiaSheet.tsx`) must handle
   the typed error. Reading each one is part of the implementation lane.

### Owning lanes

Both plans sit with this census lane until the founder names an implementing lane. Memory work falls under the memory and continuity domain; voice falls under the
voice domain. ⛔ This record does not open an implementation lane.

## 5 · Not done

No code, configuration, migration, deploy, database read (T3) or member-content read. No change to #2422's copy. JARVIS Phase 2 is in its own
session.
