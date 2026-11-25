# MAIA organism census — custody record and reconciliation (2026-11-25)

**Mandate (founder, in session, 2026-11-25):** the intelligence-architecture evaluation sits with the charter's census unit
`MAIA-ORGANISM-CENSUS-01`, under the SOULLAB-CONTINUITY-01 index (#1982). Then: "Yes, compare read-only", then
"Yes, records only".
**Standing:** this file is a **custody record**. It brings September records into canonical. It authorizes no code,
experiment, shadow deploy, runtime change, merge or deploy, and it does not re-rule anything the founder ruled
on 2026-09-06.
**Stop rule:** a finding recorded here grants no permission to repair it.

## 1 · What this change brings in, and from where

The work below was finished in September on two branches that never merged. Canonical held only the 2026-09-06
checkpoint of the map (8 of 13 pages, gate blank), and its cockpit still read `current_phase: 1`.

| Source branch @ head | Records brought in verbatim |
|---|---|
| `origin/claude/maia-whole-organism-census-01` @ `ddefe6846` (2026-09-04) | `MAIA_WHOLE_ORGANISM_CENSUS_01.md` — census CLOSED · SOURCE-COMPLETE; Gate 2 MET; Gate 3 adjudicated D → C′ |
| `origin/claude/maia-human-experience-phase1-census` @ `1b371291f` (2026-09-06) | map pages `03`, `09`, `10`, `11`, `13`; `00_RANKED_MAP.md` (13/13 gate PASS, top-10, founder adjudication §9); `HUMAN_EXPERIENCE_GAP_REGISTER.md` (Phase 2; founder rulings, two sets); master run and R&D charter updates (Phase 1 EXIT on `573d5268`, Phase 2 OPEN); `BOARD.md`; `PHASE2_READONLY_CENSUS_SPEC_2026-09-06.md`; `E1_CORRECTION_SHADOW_SPEC_2026-09-06.md`; `E5_ELEMENTAL_DESCRIPTIVE_VALIDITY_PROTOCOL_2026-09-06.md`; E5 manual v1 (superseded before use) and v2, synthetic corpus and design sheet |

**Method.** Each source file was checked against what canonical did to it since the branch's merge base. New on canonical → copied
verbatim. Present on canonical but unchanged since the merge base → replaced by the September version.
One file changed on both sides, described next.

**Page 12 — two different documents, both kept.** On canonical, `MAIA_WHOLE_ORGANISM_MAP/12_house_onboarding.md` is a
**PROPOSED NEW PAGE** written 2026-10-30 (PR #2011) by a session that did not know the September page existed. The September
census page is brought in beside it as `12_house_onboarding_2026-09-06.md`. The October file is untouched. Which page holds
the slot is a founder question; this record does not decide it.

**Deliberately NOT brought in (code; each needs its own review against 80 days of drift and its own authorization):**
`lib/maia/canonical-turn/{correctionShadow.ts, adjudicate.ts, policy.ts (pp-2), types.ts}` and tests;
`tests/constitutional/refusal-registry/` (R30 → pp-2, R32); `scripts/witness/{phase2-readonly-census.sql, phase2-readonly-census-logs.sh, e5-score.ts}`;
the branch's edits to `app/api/sovereign/app/maia/list/route.ts` and `CLAUDE.md`; and `origin/claude/e1-correction-shadow-deploy`.
**Consequence:** the E1 spec, the E5 protocol and the register describe instruments that are **not on canonical**.
Wherever the register reads "BUILT", it means built on the branch. Whether E1 ever reached production is **UNKNOWN**: it was not
checked, because that needs a read of production deploy history.

## 2 · Reconciliation of September findings at `c758fa66` (code-read only; nothing WALKED)

STANDS = code unchanged in substance · PARTLY CHANGED · UNKNOWN = not established by code-read.

| # | September finding | At `c758fa66` | Evidence |
|---|---|---|---|
| F1 | Composition is presence, not discernment (CORE appends whatever addenda are present) | **STANDS** | `lib/sovereign/maiaVoice.ts:539` |
| F2 | Three tiers, three prompt-assembly mechanisms with different memberships | **STANDS** | `maiaService.ts:883` (FAST literal `:1697`), `:1791`, `:2327` |
| F3 | Canonical-turn seam is shadow only; M3 unauthorized | **STANDS** | `list/route.ts:1587,1638`; `lib/maia/canonical-turn/partition.ts:19` |
| F4 | Spiralogic snapshot, Decision Governor, Field Wisdom, Spiral×Wu Xing bridge, relationship mode, therapeutic frame, epistemic path produced only by `/between`, never `/list` | **STANDS** (7 sampled; 0 occurrences in `list/route.ts`) | grep |
| F5 | `maiaModeAddendum`, `consultationAddendum`, `scribeSessionDiscussionAddendum` have no server producer | **STANDS** — read only from client `meta` | `maiaService.ts:1525,1531,2064,2078` |
| X8 | Elemental readings computed and discarded / post-cognition logs; no registered elemental-shadow producer | **STANDS** | no `inferred.elemental_shadow` anywhere |
| X12 | FAST lacks the constitutional floor and regeneration | **STANDS by structure**; R25/R26 not re-run | — |
| X6 · A1 | OpenAI TTS egress outside the R15 funnel | **STANDS in code**: `app/api/voice/openai-tts/route.ts:113-150` ("default voice is always maia_core (OpenAI Alloy)"; archetype → OpenAI "skipping Kokoro"). Which archetypes resolve to OpenAI in production: **UNKNOWN** | code-read |
| X4 · A2 | Write-side `longterm` bypass | **PARTLY CHANGED** — writeback now gated `!isSanctuary` (`list/route.ts:2026`), but mode is still forced `'longterm'` (`:2036`) whatever mode was requested; `isSanctuary` is only `meta.sanctuary === true` (`:427`). Ephemeral-not-Sanctuary leakage: **UNKNOWN** without a trace | code-read |
| X10/X11 | Two greeting generators, one guardrail | **STANDS** | `lib/services/greetingService.ts` |
| X13 | Validator regenerates on the system's element frame | **STANDS** | `lib/validation/socraticValidator.ts:235` (`FIRE_IN_WATER`) |
| X1–X3, X7, X14–X17; class-C witness; page line numbers (cite `cf6d9ebf` / `a4305f4`) | not re-checked | **UNKNOWN** | — |

**Net:** of the 11 findings re-checked, none is resolved and X4 is partly changed. The centre of the September map is
unchanged at `c758fa66`: no discernment at the composition seam, elemental intelligence discarded, and a canonical turn
with no authority over the reply.

## 3 · Owed (proposals; each is a founder act)

1. Rule which page 12 holds the slot (the September census page or the October proposed page).
2. Read production deploy history for the E1 candidate (`7d894b72`); read-only.
3. Finish the reconciliation of the unchecked rows and re-pin the map pages' line numbers to a current tree.
4. Review the September code (E1, pp-2, Phase-2 SQL, E5 scorer) for re-admission. This is a separate lane, with tests and independent review.
5. X6 and X4 contradict project vows at code level. They are recorded here, not repaired.

## 4 · Relation to the 2026-11-25 pasted directive

The directive's evidence levels map onto September's vocabulary: Exists = BUILT, Connected = reachable,
Participates = ACTIVE, and there is no Improves/Integrates evidence on any surface (map rank 2). The directive's priorities are the
founder's September Plane B order (E1 first, then E5 → E11 → E6). Federated and continual learning appear nowhere in the register,
and none of their preconditions is met.

## 5 · Provenance

Read at `c758fa66` (canonical `clean-main-no-secrets`, 2026-11-25). Source heads `ddefe6846`, `1b371291f`.
ECA-00 freeze verified intact (blob `3ceb98635e5929d6a172f02cfd9390e4cb0c570c`). No runtime, production, member data or
GitHub write was involved in preparing this record.
