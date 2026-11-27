# MAIA organism census — reconciliation addendum (2026-11-26)

**Extends:** `MAIA_ORGANISM_CENSUS_CUSTODY_RECORD_2026-11-25.md` (merged in #2409, merge commit `54459ca3e`).
**Mandate:** founder, in session, 2026-11-26: "yes" to two read-only items from that record's §3: the E1 production
check (item 2) and finishing the reconciliation (item 3).
**Read at:** canonical `clean-main-no-secrets` @ `7acce0d372`; production read on 2026-11-26.
**Standing:** a record. It authorizes no code, experiment, shadow deploy, runtime change or deploy.
**Stop rule:** a finding here grants no permission to repair it.

## 1 · E1 correction shadow: was it ever in production?

| Question | Answer | Evidence |
|---|---|---|
| Is E1 live now? | **No.** | Live container `maia-sovereign` reports `GIT_COMMIT=653a24b49` (created 2026-11-26 15:01Z). That commit descends from canonical and has no `lib/maia/canonical-turn/correctionShadow.ts`. |
| Was E1 ever on canonical? | **No.** | `correctionShadow.ts` is absent at `7acce0d372`. The deploy candidate `origin/claude/e1-correction-shadow-deploy` @ `0780f368f` (2026-09-06) was never merged. |
| Did E1 run in production in September? | **UNKNOWN, and not recoverable from the host.** | Production images go back only to 2026-10-21 (oldest dated tag), and none carries `0780f368` or `7d894b72`. `PRIORITY_THREAD_LOG.md` has no deploy entry for E1. September images were pruned. |

**Consequence:** the gap register's Plane B rank 1 ("know when MAIA is wrong") has **no instrument in place**. The register's
"DEPLOY AUTHORIZED 2026-09-06 … UNWITNESSED" stays historically true. For present purposes, E1 is BUILT on a branch, DISCONNECTED.

**Identity collision (names are not identity).** The September branch registers its E1 refusal as
`refusal-32-correction-shadow-observational`. On canonical, R32 is `refusal-32-no-covert-developmental-steering`.
Its jurisdiction was corrected on 2026-09-20 in commit `700b6d5247`, which **refuses renumbering R32**. Re-admitting the
September code as written would collide. Any re-admission lane needs a new registry number for the correction-shadow refusal.

## 2 · The rows not checked on 2026-11-25

Code-read at `7acce0d372`. STANDS = present in substance at or near the cited site · CHANGED · NOT FOUND (at the cited site) ·
UNKNOWN (reach or rate needs a trace or a count, not a read).

| Cluster | Item | Status | Evidence |
|---|---|---|---|
| X1 | Router shapes depth from stored spiritual/intellectual "bypassing" frequency | **STANDS** | `lib/consciousness/processingProfiles.ts:79-80,236` |
| X1 | Awareness levels Newcomer → Master | **STANDS** | `lib/consciousness/awareness-levels.ts:7-13`; `lib/ain/awareness-levels.ts:283` |
| X1 | Greeting intimacy tiered by `morphicResonance` / `encounterCount` | **STANDS** | `lib/services/greetingService.ts:124,164,377` |
| X1 | Bloom "pull toward Level N+1 … do NOT mention" in `maiaService.ts` | **NOT FOUND** at the cited site or elsewhere in `lib/` and `app/`. Possibly removed; no removal commit identified | grep |
| X2 | "[IMPLICIT GUIDANCE - DO NOT EXPLAIN TO USER] … Keep ALL frameworks invisible" | **STANDS** | `lib/consciousness/awareness-levels.ts:412-414,469` |
| X2 | "Do not quote this section directly" | **STANDS**, now on both routes | `app/api/sovereign/app/maia/list/route.ts:1059`; `app/api/between/chat/route.ts:1663` |
| X2 | NLP "pattern interruption, reframing" as undisclosed method | **STANDS** | `lib/sovereign/maiaVoice.ts:705` |
| X3 | Every significant exchange labelled `pattern` | **STANDS** | `lib/memory/MemoryWriteback.ts:646-672` |
| X3 | Regex "breakthrough" that fires on thank / grateful / realize | **STANDS** | `lib/memory/MemoryWriteback.ts:472` |
| X3 | Relational rows from live turns | **STANDS** (file present; changed since September, so the line cites have drifted) | `lib/consciousness/relationalObserver.ts` |
| X3 | Member inspect / reject / withdraw surface for inferred relationship records | **NOT FOUND** (no matching route under `app/api`) | path search |
| X7 | Present statement compared to stored material; supersession | **STANDS (absence)**. `supersedes` exists only for proposals (`database/migrations/20260914000001_proposal_succession.sql:135`), not memory. The only contradiction detectors check the current text (`maia-consciousness-tracker.ts:306`) or prior experiential validation (`lib/experiential-validation.ts:61`). | grep |
| X14 | Flourishing domains composed into prompts | **STANDS** | `lib/nowWhat/flourishingDomains.ts` |
| X14 | House trajectory vocabulary as data ("moving from repetition toward recognition") | **STANDS** | `lib/memory/MemoryWriteback.ts:155` |
| X15 | "you KNOW this practice … Never claim not to know the practitioner" | **STANDS** | `lib/practiceField/practiceFieldService.ts:337-339` |
| X16 | FAQ "Panconscious Field Intelligence (PFI) — a consciousness field model" | **STANDS, and wider than recorded:** the same FAQ opens "**MAIA is not an LLM.**" Canonical cognition calls Claude (`ANTHROPIC_API_KEY`, project anchor), so this sentence sits above its rung under claim discipline | `components/onboarding/FAQSection.tsx:37,51,263` |
| X16 | Privacy page "No account required" | **STANDS** | `app/maia/privacy/page.tsx:102` |
| X16 | `PRACTICE_FIELD_SPEC.md` cited but absent | **STANDS** (still absent) | path search |
| X16 | Co-Lab gate doc names a non-existent script | **CHANGED**: the doc no longer names `verify-colab-boundaries`; the project anchor records the correction | `docs/ops/COLAB_RELEASE_GATE.md` |
| X17 | `companion` archetype | **STANDS**; 2 importers of `ArchetypalConstellation`. Reach not traced | `lib/consciousness/ArchetypalConstellation.ts:50,430` |
| X17 | Nudge "No rush, I'm here for you." | **STANDS**; 1 importer of `NudgeSystem`. Whether it is mounted: UNKNOWN | `lib/voice/NudgeSystem.ts:22` |
| X17 | Rupture "I missed you, and I'm sorry" | **STANDS**; 1 importer of `rupture-repair-service`. Reach not traced | `lib/consultation/rupture-repair-service.ts:106` |

**Net across both days:**
- 33 findings re-checked (11 on 2026-11-25, 22 here):
  - 29 STANDS, including confirmed absences;
  - 2 changed or partly changed: X4, and the Co-Lab doc defect;
  - 2 NOT FOUND. The Bloom concealment instruction may have been removed. The missing member withdraw surface is itself a confirmed absence.
- **None of the contradictions is resolved.**
- Class-C human witness for any subsystem remains **none** (map rank 2), unchanged.

## 3 · Line-number drift of the map pages

All 13 subsystem pages (including both page-12 documents), `00_RANKED_MAP.md` and `MAIA_WHOLE_ORGANISM_CENSUS_01.md` were scanned.

| Measure | Value |
|---|---|
| Path citations | 735 (420 distinct paths) |
| Cited paths missing at `7acce0d372` | **0** |
| `path:line` citations | 428, across 228 files |
| Line-cited files **unchanged** since the cited tree (`cf6d9ebf`) | 182 of 228: their line numbers remain exact |
| Line-cited files **changed** since | **46 of 228**: their line numbers may have drifted |
| Line citations past end of file | 1 (`06_relationships.md`) |

The 46 changed files are listed below. The pages were **not edited**: they are September records, and rewriting their line numbers
would erase what they observed. A reader citing a page line inside one of these files should re-locate by symbol, not by number.

`app/api/between/chat/route.ts` · `app/api/members/recall-preferences/route.ts` · `app/api/oracle/conversation/route.ts` ·
`app/api/practice/growth/route.ts` · `app/api/sovereign/app/maia/list/route.ts` · `app/api/voice/stream-conversation/route.ts` ·
`app/faq/page.tsx` · `app/maia/page.tsx` · `app/oauth-success/page.tsx` · `app/onboarding/page.tsx` · `app/relationships/[id]/page.tsx` ·
`app/relationships/page.tsx` · `app/writers-studio/HomeView.tsx` · `components/OracleConversation.tsx` ·
`components/account/AccountSettings.tsx` · `components/maia/MaiaHouseSheet.tsx` · `components/maia/MaiaLeftRail.tsx` ·
`components/onboarding/BirthDataStep.tsx` · `components/relationships/EmptyRelationalField.tsx` ·
`components/session/SessionRitualClosing.tsx` · `components/settings/MemoryConsentSection.tsx` · `components/ui/ModernTextInput.tsx` ·
`components/ui/SacredLabDrawer.tsx` · `components/voice/ContinuousConversation.tsx` · `components/voice/VoiceInteractionBar.tsx` ·
`lib/consciousness/maiaOrchestrator.ts` · `lib/consciousness/relationalCheckin.ts` · `lib/consciousness/relationalObserver.ts` ·
`lib/email/sendBetaInvite.ts` · `lib/encounters/threshold.ts` · `lib/library/LibraryService.ts` · `lib/maia/canonical-turn/floor.ts` ·
`lib/maia/memoryAtomsLoader.ts` · `lib/memory/MemoryBundle.ts` · `lib/memory/MemoryWriteback.ts` · `lib/navigation/houseDestinations.ts` ·
`lib/practice/PracticeStore.ts` · `lib/relationships/formatRelationalContextForPrompt.ts` · `lib/sovereign/maiaService.ts` ·
`lib/sovereign/maiaVoice.ts` · `lib/sovereign/platformKnowledge.ts` · `lib/utils/feature-flags.ts` · `lib/voice/voiceCommands.ts` ·
`lib/voice/voiceTiming.ts` · `scripts/capacitor-patch-routes.sh` · `scripts/verify-constitution-colab.ts`

## 4 · Owed (each a founder act; carried from 2026-11-25, updated)

1. **Rule X6 and X4.** Both contradict project vows in code: OpenAI TTS outside R15; writeback forced `longterm` outside Sanctuary. Opening a remedy lane is a founder act. This census cannot authorize it.
2. **Rule on X16's "MAIA is not an LLM".** It is newly widened here and is public-facing onboarding copy. It may bear on the marketing reconciliation's claim matrix.
3. **Page-12 slot ruling.** Unchanged.
4. **E1 re-admission**, if wanted: a separate lane with review, a new refusal number (R32 is taken) and a fresh deploy authorization. The September authorization was for an isolated commit that never shipped through canonical.
5. **Reach traces**, read-only and the next census step if authorized: is the nudge, rupture and companion copy reachable from a mounted surface; does a request for ephemeral memory, when not Sanctuary, form long-term memory (X4); which voice archetypes resolve to OpenAI in production (X6).

## 5 · Provenance

Canonical `7acce0d372`. Production read on 2026-11-26 by SSH: `docker exec maia-sovereign printenv GIT_COMMIT`, plus
`docker image inspect` across `maia-sovereign:*`. No container changed and no database queried. Source branches
`ddefe6846`, `1b371291f`, `0780f368f`. Drift computed by `git diff --name-only cf6d9ebf..7acce0d372` over the 228 line-cited files.
