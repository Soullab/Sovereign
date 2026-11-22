---
room: Sound Studio / Living Library
human_activity: exploring original sonic compositions through nature, geometry, elemental experience and becoming; choosing an intentional sound, listening, pausing and stopping while remaining free to create one's own meanings
surfaces:
  - app/listen/SoundAtlasDesk.tsx
  - app/listen/SoundStudioNow.tsx
  - app/listen/ListenRoom.tsx
change_class: experiential
principles:
  - INHABITABLE_ARCHITECTURE_STANDARD — the Library is a room within the existing Sound Studio and supports participatory listening rather than making the House into a catalogue
  - SOULLAB_THEME — legible, restrained typography and sound-oriented navigation across phone and desktop
  - AUDIO-PLATFORM-01 — one member-directed audio lease with shared Pause, Stop, speech priority and no autoplay
  - LISTEN-01 and MEDIA RIGHTS — original synthesized studies only; no unlicensed recordings, material effect claims or recording-rights bypass
  - SOULLAB-CONTINUITY-01 — existing Living Library review integration only; source admission and public deployment remain separate and held
reference_surfaces:
  - docs/design/contracts/sound-studio-liquid-harmonics.md — established engine and one procedural-study player
  - docs/design/contracts/sound-field.md — established audio/session custody and reversible listening
  - docs/design/contracts/sound-studio-orbit-threshold.md — existing listening Lab references and meaningful visual evidence
  - app/listen/SoundStudioNow.tsx — prior Now entrance, retained alongside Library invitation
shared_with_house: the existing Soullab human-first orientation, legibility, explicit participation, and member-owned start, pause and stop; one common persistent listening player and restrained presentation
distinct_to_room: seven editorial collection worlds and twenty-five original procedural studies, navigable both by natural pattern and by human intention; visual motifs are explicitly illustrative rather than measurements
screenshot_desktop: docs/design/contracts/screenshots/sound-studio-living-library-desktop.png
screenshot_mobile: docs/design/contracts/screenshots/sound-studio-living-library-mobile.png
experience_verification: 2026-11-22 real Chrome local review verified 14/14 browser checks and 7/7 native Now-to-Library route checks; at 390px no horizontal overflow or autoplay, own sound begins only with Listen, shared player owns Pause and Stop, and zero page errors; founder reviewed the library and said “the library is amazing. lets integrate it”; Safari/iPhone and actual production auth are not qualified.
---

# SOULLAB · Sound Studio Living Library v0.1
**Founder's direction, 22 November 2026:** "let's fully create this", following approval of seven sound collections and the Venus Rose signature collection. **Founder listening witness and integration direction (verbatim):** "the library is amazing. lets integrate it". This supports review-source integration only, not final mastering or production release.

**Status:** Review-only native Sound Studio source candidate; NOT MERGED, NOT DEPLOYED, NO MEDIA OR MEMBER ADMISSION.
**Authority:** LISTEN-01 #1979; continuity #1982; audio output coordination #1984; Sound & Sensing Node #1981 for any future hardware.
**Branch/worktree:** feature/listen-liquid-harmonics-review-20261121; /Users/soullab/.jarvis-worktrees/listen-liquid-harmonics-20261121.
**Source custody:** Existing /listen, PersistentListeningProvider and existing Liquid Harmonics engine. No parallel app, separate audio context, new release lane, hosted audio service, or rights exception.

## What exists today
- Native Sound Studio navigation item **Library**; Now offers **Explore the Living Library**.
- A responsive first-person studio listening shelf with the two entry choices **Explore a world** and **Begin with what's alive**.
- Seven collection cards, 25 original procedural listening studies and six intention filters: Settle, Focus, Create, Explore, Reflect, Restore.
- Search, selecting a world and a work, 7 distinct mathematical-art visual motifs (illustrations, NOT audio-reactive measurement), study detail, context, provenance, duration, recipe export.
- Play / Pause / Stop uses the ONE existing PersistentListeningProvider; no autoplay. No server storage, tracking, foreign audio, browser audio capture, or new entitlement bypass.
- All 25 works synthesize audio inside the browser. 23 are five-phase (Arrival, Turning, Opening, Flowering, Return) original scores driven by the existing Liquid Harmonics instrument. Two Venus studies use special original Web Audio voices: an exact 639-Hz sine-based Pure Form and an 8:13 rhythmic Orbital Dance with 8 and 13 amplitude cycles per minute.
- The two custom Venus synthesis paths use the shared audio context and destination; they do not own a second player. Session time is measured in AudioContext time to respect Pause.
- Original scores are exportable as JSON, not as mastered audio files. No claim these previews are the Sound Studio's final mastered releases.

## Collections and initial works
| Collection | Original review studies |
| --- | --- |
| Celestial Harmonics (4) | Pure Form; Orbital Dance; Venus in Water; The Living Rose |
| Harmonic Geometry (3) | Chladni Lines; Harmonics in Bloom; Between Two Tones |
| Elemental Alchemy (5) | Earth Holding; Water Returning; Fire Becoming; Air Between; Aether Spiral |
| Voices of the Living Earth (3) | Pollinator Patterns; Under Blue Water; Rain Geometry |
| Human Voice & Sacred Traditions (3) | Five Open Vowels; Harmonic Loom; Bell and Breath |
| Liquid Harmonics & Emergent Worlds (3) | Liquid Mirror; Alien Intelligence 01; Inverse Spiral |
| Journeys of Becoming (4) | Arrival; Spiral of Presence; Across the Threshold; Homeward |

The **Living Earth** previews are purely synthesized nature-inspired abstractions, not real recordings of animals or habitats. The **Voice & Sacred Traditions** previews are original synthesized vowel and bell-like work, not ceremonies or recordings by any performers. Real species recordings, chants, instruments, artwork and commercial masters each require rights, provenance and cultural context before admission.

## Venus Rose — the founder's first signature collection
1. **Pure Form** (6 min): a precisely set 639-Hz sinusoidal carrier, with low, original supportive partials. 639 is chosen musically and NOT an acoustic emission from Venus.
2. **Orbital Dance** (8 min): original 159.75/239.625/319.5/639 Hz harmonic figures with independent 8/60 and 13/60 Hz amplitude pulses. It is an ARTISTIC interpretation of Earth's approximate 8-year/13-Venus-orbit recurrence.
3. **Venus in Water** (10 min): shifting partials with original synthetic water-like texture and breathing of space, generated by the existing Liquid Harmonics engine.
4. **The Living Rose** (15 min): a continuous fivefold procedural journey through the five named phases, ending in silence.

The five-petaled Venus rose is an astronomical visualization based on approximate Earth–Venus orbital resonance. Its rendering in this shelf is a mathematical illustration, not a physical cymatic observation. A physical cymatics rig and recorded measurements require their own research protocol.

Reference reel: https://www.instagram.com/reel/DfemWa5CpsW/
Attribution: original Instagram audio @resonara1. **Discovery reference only. No recordings, stills or copyrighted audio from the reel are copied, embedded, licensed or admitted.** This source inspired editorial inquiry; the works use independent oscillator code.

## Music and numerical integrity — corrected in this build
The first headless-browser attempt exposed a bug in **the new Living Library score mapping**: the builder tried to read a nonexistent work property, producing non-finite control values that later reached the existing melodic note oscillator. This was not evidence of a defect in the shared Liquid Harmonics music layer.
The source mapping was corrected to use the catalog's existing finite "spiral" parameter. The catalog's selected gentle music balance was restored (up to 0.4); the existing engine and another lane's Touch Phase work were not edited.
After correction, the real shared-player browser fixture passed 14/14 checks, including a five-part original piece with melody enabled, and zero JavaScript errors. Generated musical arrangements remain founder-review studies, not mastered releases.

## Verification
- Static native bundle esbuild parsing: pass.
- New catalog and score assertions: 6/6, including 25 unique works, category distribution, 150 named score movements, no outside audio.
- Browser fixture (real persistent provider + actual native SoundAtlasDesk): 14/14 pass at 390px mobile and desktop, with both original Venus synthesis paths, five-phase engine sound, shared single-player lease, Pause/Stop, filters, recipe download, zero page errors, zero external requests, responsive screenshots.
- No independent mastering, Safari/iPhone, speech/other media concurrency, full platform typecheck, authenticated real /listen, member isolation, media-rights reviewer, real physical cymatic/tactile apparatus, listening-level calibration or founder felt witness established.
- The actual native ListenRoom route fixture (Now → Library → Now, shared playback) passed **7/7** browser checks with no JavaScript errors and no overflow at 390 px.
- Existing Liquid Harmonics unit test suite passed **11/11**.
- Scoped TypeScript check with review-only CSS and process ambient definitions passed **0 diagnostics**; this is not a whole-repository typecheck.
- Full repository TypeScript check with the default 4 GB Node heap returned OOM / exit 134 before diagnostics; cannot claim repository typecheck PASS from that run.
- No public feature flag changed, no PR, no merge, no deployment.

## Specific source files
- lib/listening/soundAtlasCatalog.ts — all seven collections and 25 authorial sound recipes (single source of editorial catalog truth)
- lib/listening/soundAtlasStudy.ts — safe original audio factory on shared transport, plus score creation
- app/listen/SoundAtlasDesk.tsx — native browsing, playback, geometric motifs, search, intent routes and recipe export
- app/listen/ListenRoom.tsx, app/listen/SoundStudioNow.tsx, app/listen/listen.module.css — existing native navigation and review-only presentation
- tests/listening/sound_atlas_catalog.test.cjs — catalog/score witness
- tests/listening/sound_atlas_fixture.cjs — local 127.0.0.1:8752 review fixture; not production
- tests/listening/sound_atlas_browser_witness.cjs — real-browser shared player witness
- docs/design/contracts/screenshots/sound-studio-living-library-{mobile,desktop}.png — local witness screenshots

## Editorial acceptance and release gates
- Founder listens to at least all four Venus studies and one piece in each other collection, preserving observations verbatim. Founder can request refinements; technical tests are not a listening verdict.
- Security/privacy/rights check before accepting source. The future admitted media collection needs authoritative master/composition rights, explicit territory, streaming/download/group permission, revocation and receipts. The existing SOUND_STUDIO_MEDIA_ALLOWLIST remains unchanged.
- The founder explicitly requested Library integration after hearing the local review. Commit only the Library-specific paths on the **already established Liquid Harmonics review branch**, with an exact path manifest and validated tests. Do not touch the distinct shared Capture worktree (subject to its separate one-committer ruling). Acceptance into canonical main, member access, merge, deploy and review flags remain separate, still-held decisions.
- Broader font sizes, mobile navigation, Safari/iPhone, screen lock, reduced-motion and keyboard interaction should receive genuine-device witness. Loopback fixture is dev-only.
- True spatial visuals, audio-reactive geometry, mechanical cymatic patterns and independently driven four-point tactile fields are future separate evidence-gated phases. The Node #1981 hardware/member release hold stands.
- Sound is an invitation to participation and meaning, not surveillance or a scientifically established therapy.
