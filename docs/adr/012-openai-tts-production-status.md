# ADR-012: OpenAI TTS Production Status (archetype→OpenAI default)

**Status:** Decided: **not authorized** (founder ruling, 2026-11-26). The remedy is **not yet implemented**.
**Date:** 2026-07-07 (stub) · 2026-11-26 (ruling)
**Authors:** — (stub); the ruling is Kelly's (see "Ruling (2026-11-26)" below)
**Reviewers:**

> **Status: Decided: production OpenAI speech outside the governed provider interface is NOT authorized.**
>
> The code still has the bypass. As of 2026-11-26 production still sends the default `maia_*`
> voices to OpenAI (trace T1/T2, `docs/programme/MAIA_ORGANISM_CENSUS_FOUNDER_RULINGS_2026-11-26.md`).
> This ruling does not authorize the remedy, any configuration change or any deploy; each is a separately authorized act.

## Ruling (2026-11-26)

**Source:** a founder direction issued in session on 2026-11-26 to the `MAIA-ORGANISM-CENSUS-01` lane. The text was drafted by another
assistant and pasted in by Kelly:

> *"Do not authorize production OpenAI speech outside the governed provider interface. Record the ruling in ADR-012. Maintain
> local-first processing and qualify all fallback mechanisms. AIN OS remains model-independent in its architectural direction."*

The accompanying rationale says this is not opposition to OpenAI as such. It is opposition to "computational services
operating outside our governing architecture". Every speech provider participates through a qualified interface that respects
member consent and data sovereignty, local-first processing, explicit admission of cloud providers, transparent fallback, and voice quality
and relational continuity. Kokoro's health and voice quality are to be established **before** production changes. Browser speech is to be
**qualified, not assumed** to be private or local.

**What this settles:**
- The archetype→OpenAI default (every `maia_*` archetype, `lib/voice/voiceArchetypes.ts:58-72`) is **not ratified**.
- The OpenAI fallback after a local failure (`app/api/voice/openai-tts/route.ts:298-312`) is **not ratified**.
- R15's scope must cover every production speech egress, not only `ttsRouter.synthesize()`.

**What this does not settle:**
- The remedy design (see the census rulings record, §4b).
- Whether a cloud provider could later be *admitted* through the governed interface. That would need its own explicit
  admission record.

## Original stub text (2026-07-07, preserved)

> **Status: Open / Deferred**
>
> This ADR exists because R15 currently references the archetype→OpenAI TTS question.
> No production authorization is granted by this document.

## Context

Refusal **R15** (`lib/tts/ttsRouter.ts` — `assertProviderQualified`) governs which TTS
providers a deployment context may *select*. In `production-maia` the qualified set is
verified-local-only (`auto`, `kokoro`); `openai`, `pplex`, and `sesame` are refused there.

R15 does **not** resolve a separate, adjacent question: the **archetype→OpenAI default**,
whereby certain MAIA voice archetypes (the "feminine" / `maia_*` family) resolve to OpenAI
cloud TTS via the archetype-intercept path in `synthesize()` — a path R15 explicitly does
not gate (see the guard comment: *"Does not touch the archetype→OpenAI path below — that is
ADR-012's open question."*). Several artifacts already cite this ADR as the decision record
for that question, but the ADR did not exist. This stub resolves the dangling reference
without pretending the question is decided.

## Decision (stub, 2026-07-07; superseded by the 2026-11-26 ruling above)

**None. The archetype→OpenAI question is deferred.**

No production authorization for cloud TTS on the archetype path is granted or implied by
this document. The status quo (whatever the archetype-intercept currently does) is neither
ratified nor prohibited here — it awaits a substantive ruling by Kelly. Until then:

- R15 remains the operative refusal for *explicit provider selection* (unchanged by this ADR).
- The archetype→OpenAI default remains an open governance question, not a settled policy.
- Widening any production allow-list still requires an explicit, referenced decision — this
  stub is **not** that decision.

## Consequences

### Positive
- R15 and its companion artifacts no longer cite a missing governance artifact; the PR can
  proceed with an intact reference chain.
- The open question is named and located, not silently carried.

### Negative
- The archetype→OpenAI default remains unresolved; this ADR must be revisited before any
  claim that OpenAI is absent from production, or before the archetype path is ratified.

### Neutral
- Purely documentary; no code or configuration changes accompany this stub.

## References

Artifacts that cite this ADR (the reference chain this stub closes):

- `lib/tts/ttsRouter.ts` — R15 guard comment ("governance question: docs/adr/012")
- `lib/tts/providers/personaplex.ts` — adapter header note
- `tests/constitutional/refusal-registry/refusal-15-tts-provider-qualification-guard.ts` — decision-record citation
- `docs/architecture/REFUSAL_REGISTRY.md` — R15 row + harness note ("separate open governance question")
- `docs/specs/VOICE_LAB_SPEC_2026-07-06.md` — companion-to reference

Related commits:

- `3263453a9` — feat(voice): PersonaPlex as second real TTS provider (pplex), lab-gated behind R15
- `6a7eaf9cb` — fix(voice): remove sesame from production-maia qualified providers (R15)
