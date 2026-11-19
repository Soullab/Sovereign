# Studio Academy · Exploration (2026-11-19)

```
STATUS:    EXPLORATION for the founder. It authorizes nothing. Each piece needs its own founder act.
CANONICAL: 02f10f662 (read for every claim below). Production: 18588a7e.
BUILDS ON: docs/programme/WRITERS-ACADEMY_ROADMAP_2026-11-02.md (this is its Phase 2–5, widened)
RULING:    §5 RULED by the founder 2026-11-19 (Kelly, in session): option (a), "Writer shares each one".
           A principle, not a build: nothing in this document is authorized to build. Everything a
           writer has not shared stays under the 2026-11-01 ruling: Soullab does not read it.
```

## 1. What the founder asked (2026-11-19, in conversation)

- Turn the click-through guides into a **Studio Academy** for every Studio: one journey per form
  (nonfiction, fiction/fantasy, song, play, screenplay, poetry, and more), each with its own
  overview, so writers are acquainted before they dive in. "The hard part is the start for everyone."
- Ask writers questions that help Soullab, let them ask MAIA questions that help them, and **see
  the responses as they come in**, without emails or texts.
- Responses can be **written, audio or video**, and Soullab could **learn from MAIA interactions**.
- Short explainer films could be made with the Lemo-Opuscar video skill.

## 2. What already stands (verified at 02f10f662)

| Thing | Standing | Where |
|---|---|---|
| Academy roadmap: Phase 0 live (Teach-me in 11 places); Phase 1 = Jondi's walk sets Phase 2's order; Door 2 (an explicit Academy room) only by founder act | roadmap, authorizes nothing | `docs/programme/WRITERS-ACADEMY_ROADMAP_2026-11-02.md:4-87` |
| Forbidden in the Academy: levels, tracks, progress, streaks, certificates | roadmap | same, `:19` |
| Onboarding canon: first value "without a tutorial"; **avoid genre taxonomy as prerequisite**, experience-level selection, mandatory templates or outline | flagship canon | `docs/design/writers-studio/flagship/FIRST_ARRIVAL_AND_ONBOARDING_CANON_v1.md:190` |
| Tester journey ruling (founder, 2026-11-01): Soullab asks in Soullab's voice, **separate from MAIA**; **no reading of manuscripts, MAIA conversations or sessions for research**; no dwell, click, engagement or completion tracking; self-hosted only | ruled design | `docs/programme/WRITERS-STUDIO-SEMANTIC-FIELD-01_TESTER_JOURNEY_FIELD_DESIGN_NOTE_2026-11-01.md` §3.3–3.4 |
| Invariant 15: human-deliberated learning allowed; member → behaviour signal → **automatic** adaptation prohibited | ratified canon | `docs/canon/MAIA_SOVEREIGNTY_INVARIANTS.md` Invariant 15 |
| Beta journey (live, beta writers): 5 questions; see, change, withdraw; per-answer sharing to the Beta Co-Lab; founder sees "All writers' answers" | live | `app/dev/writers-studio-p4r1/P4R1BetaJourney.tsx`, `lib/writersStudio/journey.ts`, `writer_studio_journey_answers` |
| Beta feedback membrane (live): 8 fixed signals and an optional note | live | `lib/writersStudio/betaFeedback.ts`, `writer_studio_beta_feedback` |
| **Defect found:** the feedback route accepts Publish and Listen, but the table's check constraint does not, so feedback sent from Publish or Listen should fail to save | discovered, not fixed | `app/api/sovereign/writers-studio/beta-feedback/route.ts:9` vs migration `20260929000005…:21` |
| Studio paths (live): a registry with one path (College Essay), with stages, MAIA posture and per-path wording; chosen only by the member's own link; fixed once chosen | live | `lib/writersStudio/studioPaths.ts:108-150`, `living_works.studio_path` |
| Work kinds (live): fiction, nonfiction, practitioner | live | `lib/writersStudio/workKindShared.ts:5` |
| Consent toggles "Anonymous Insights" and "Research Participation": stored, **read by nothing** | dormant | `components/account/AccountSettings.tsx:2374-2375` |
| "What do I do next?" button | PR open, not merged or deployed | SoullabTech/Sovereign#2344 |
| Click-through guides (new Work / existing Work) | private artifact; source in this PR | `docs/design/author-studio/beta-guides/` |
| Persona walk of a named beta writer | private artifact only, **deliberately kept out of this public repository** | none |

**Conclusion:** per-form journeys should be **Studio paths** in the existing registry, not a new
primitive. Soullab asking writers should **extend the Beta journey**, not start a second channel.

## 3. Proposal: three layers

### A. A way in for each form (built as Studio paths)

Each form gets its own path, always optional. "Just let me write" and "I don't know yet" stay on
every door, so the canon's "no genre prerequisite" holds.

Each path has:
1. **A short welcome film** (30–60 s, Lemo-Opuscar). It is skippable and shown only on request,
   because pushed intro tours do not help (NN/g mobile-tutorial study).
2. **A practice page in the real editor.** A sample that explains each element where it sits, which
   the writer deletes or keeps. Writing tools that teach well do it inside the real document.
3. **The first few essentials only** (progressive disclosure):

| Form | First essentials | MAIA's first question (draft) |
|---|---|---|
| Nonfiction / practitioner | the reader and their problem, the book's promise, a one-paragraph-per-chapter outline | "Who is this book for, and what will they be able to do after reading it?" |
| Novel / fantasy | a premise, one character's goal and obstacle, only the world the story touches | "Who wants something here, and what's in the way?" |
| Song | the hook, a verse and a chorus, words that sit with the melody | "What line would you want people singing back to you?" |
| Stage play | one scene, character names and stage directions in play format | "Who is on stage, and what does one of them need from the other?" |
| Screenplay | one scene with a scene heading (INT./EXT.), action, dialogue, standard format | "Where are we, and what do we see first?" |
| Poetry | one concrete image, then the line | "What's one thing you can see, hear or touch that this poem is about?" |

4. **Its own "What do I do next?" answers** (#2344's pattern, per path).
5. **Click-through guides on request** ("Show me around"), served from the Studio. No levels,
   progress, streaks or certificates (roadmap §19).

### B. Soullab listens: four channels, each with its own consent

| Channel | What Soullab sees | Consent | Standing |
|---|---|---|---|
| 1. Soullab asks (extends the Beta journey) | the writer's own answers, written or recorded | answering is the consent; see, change, withdraw | live (text); audio/video new |
| 2. The writer asks MAIA | nothing; MAIA's answer is the writer's | none needed | live (studioGuide, #2344) |
| 3. The writer shares an exchange with Soullab | only exchanges the writer chooses to share, one at a time | an explicit share each time; never in Sanctuary; withdrawable | ruled 2026-11-19 (a); not built |
| 4. The writer writes to Soullab in the Co-Lab (founder, 2026-11-19) | what the writer posts, in their own words, to the people in that channel | posting is the consent; the Co-Lab's own rules apply | live: a Beta journey answer can already be shared there one at a time, and bug reports mirror to the #bugs channel |

Channel 4 is the writers' own space, shared with others, so the Listening page should **link to** Co-Lab posts rather than copy them, and a writer's withdrawal or deletion in the Co-Lab must hold there too.

Rules for channel 1, drawn from the research:
- Ask at a natural pause (after showing MAIA the first page, after a first reading), **never mid-draft**.
- **Keep the ruled cadence, enforced in code:** at most once per question wave (2026-11-01 note, line 94), one to three items. Stop asking
  a question once there are enough answers.
- Always in **Soullab's voice, never MAIA's** (2026-11-01 ruling). MAIA does not ask for feedback.
- **Audio and video:** recorded in the browser, stored self-hosted, transcribed by `maia-whisper`
  (local), with a yes for each recording, playback before sending, and deletion at any time. State
  the retention limit at the moment of recording.
- No click, dwell or completion tracking, so presses of "What do I do next?" are **not** counted.

**Seeing responses as they arrive:** a founder "Listening" page that extends the existing "All
writers' answers" view. New answers and shared exchanges appear as they are given. Themes may be
drafted by a model but are **checked by a person before anyone acts on them**, and any change goes
through human deliberation (Invariant 15). Nothing adapts automatically. Writers see a "What we
heard and what changed" page, so their answers visibly matter.

### C. Films and guides

Lemo-Opuscar welcome films and short how-to clips, kept to what is live (claim discipline). They are
offered beside the step, never autoplayed.

## 4. Proposed order of work (each step its own founder act)

1. Fix the beta-feedback defect (Publish and Listen feedback should fail to save today).
2. Merge and deploy #2344, then **Jondi's walk** (roadmap Phase 1) with the guides at hand. Her
   answers set the next steps, as the roadmap already says.
3. **One path first: nonfiction / practitioner** (the first beta writers' path), with a practice
   page, film and questions. Walk it with her, then with a second writer.
4. Audio and video answers in the Beta journey.
5. Channel 3, only after the §5 ruling.
6. The other forms one at a time, each with its own witness walk. Then Door 2 (an explicit Academy
   room), per the roadmap, by founder act.

## 5. The one question of principle

**May Soullab learn from writers' conversations with MAIA, and if so, how?**

The 2026-11-01 ruling says no reading of MAIA conversations for research. The founder now wants to
learn from MAIA interactions. Options:

- **(a) Recommended: the writer shares a single exchange.** A "Share this with Soullab" control on an
  exchange (or on a whole conversation), like the per-answer Co-Lab share that already exists.
  Soullab sees only what was handed over, it is never available in Sanctuary, and it can be
  withdrawn. The member stays the author of every disclosure, and the ruling's protection holds for
  everything not shared.
- **(b) A standing research opt-in** (wire the dormant "Research Participation" toggle). Soullab could
  read all of a consenting writer's non-Sanctuary conversations. This is broader and easier to
  forget once given. The research found that default or standing "help improve" consent is the most
  criticized pattern in AI products. It needs a visible "what you've shared" page, a retention
  limit, and a reminder of the right to withdraw.
- **(c) Default access.** Not open: it is stealth memory under the Oath's consent rule.

**Recommended ruling:** (a), with (b) left closed.

**⭐ RULED 2026-11-19 (founder, in session): (a), "Writer shares each one".** What this settles:
- Soullab may learn from a writer's MAIA exchange **only** when that writer shares it, one exchange
  (or one conversation) at a time, by their own explicit act.
- **Never in Sanctuary.** A shared exchange can be withdrawn.
- (b), a standing research opt-in, stays **closed**. (c) is not open.
- The 2026-11-01 ruling §3.3 is **narrowed, not replaced**. Soullab still does not read manuscripts,
  sessions or any MAIA conversation the writer has not shared, and still does no click, dwell or
  completion tracking.

What it does **not** settle: the control's wording and placement, where shared exchanges are stored,
the retention limit, who on Soullab's side may read them, and the withdraw path. Those belong to a
design and build that need their own founder act.

## 6. Not authorized by this document

Any build, migration, recording, storage or deploy. Any change to the 2026-11-01 ruling until the
founder rules §5. Sending the guides to any writer. Any wording in MAIA's voice beyond drafts.

## Sources (research, 2026-11-19)

NN/g on mobile tutorials, onboarding, help, empty states and progressive disclosure · a 2023
systematic review of mobile design guidelines for users aged 60+ (PMC10557006) · W3C WAI older users
· craft guides for proposals, worldbuilding, song structure, play and screenplay format, and poetry
line breaks (Writer's Digest, Purdue OWL, Poetry Foundation and others; practitioner consensus) ·
experience-sampling burden studies (Maastricht 2025; KU Leuven 2021) · NN/g on diary studies and
informed consent · Stanford HAI 2025 on chatbot training defaults · EDPB 2026 guidance on scientific
research under GDPR (interpretation, not legal advice) · CPRA on sensitive personal information
(flag for counsel) · de-identification of free text (AI & Ethics 2025) · ISO/IEC TS 27560 consent
receipts · dark-pattern taxonomies (2021, 2024) · reciprocal co-design (UTS). Full URLs are in the
session's research report. Vendor survey benchmarks are weak evidence.
