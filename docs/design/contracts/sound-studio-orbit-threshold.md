---
room: Sound Studio / Lab / Orbit & Threshold
human_activity: circulating attention around the body with one's own breath, guided by a moving sound (fire rising up the back, water flowing down the front), and, only if the listener chooses, letting that orbit open at the brow into a brief full field that narrows, locks and gives way to real silence
surfaces:
  - app/listen/OrbitThresholdDesk.tsx
  - lib/listening/orbitThreshold.ts
  - lib/listening/proceduralStudy.ts
principles:
  - MARKETING_CLAIM_DISCIPLINE — an artistic sketch for review; no state, effect or health outcome is claimed, and nothing says it imitates or induces any experience
  - MAIA_CANON v1.1 — reflection, never authority; the room never tells a person what they will feel or what a feeling means
  - AUDIO-PLATFORM-01 — member intent governs start, pause, resume and Stop; one Soullab sound at a time; MAIA speech takes priority; nothing restarts by itself
  - SOULLAB-CONTINUITY-01 / LISTEN-01 — the one existing player, level control, dock and Stop; the study adds no second player, no second level and no recorded media
  - Founder ruling 2026-11-17 on LISTEN-01 (#1979) — review-only branch; the review flag, member access, merge and deployment stay held
  - Threshold & Return v0.1 addendum (founder observations 9–14) and Orbit & Threshold spec v0.7 draft — the route, the 7-inch toroidal ball, one breath per point, the space between elements, the 4–7 s instant
reference_surfaces:
  - docs/design/contracts/sound-studio-tone-lab.md — the neighbouring Lab instrument, its honesty about claims and its use of the one player
  - docs/design/contracts/sound-studio-field.md — the same field, player bar, level and Stop
shared_with_house: the same deep contained field, editorial serif headings, restrained gold signal and plain human language; the same persistent player bar carries the sound, its Level, Pause and Stop
distinct_to_room: a practice paced by the listener's own breath rather than a track with a clock. Fire and water are the only colours, because they are the two elements the founder names. The threshold is opt-in, armed by hand or after a chosen number of orbits, and its silence is drawn as nothing at all
screenshot_desktop:
  - docs/design/contracts/screenshots/sound-studio-orbit-threshold-desktop.png
screenshot_mobile:
  - docs/design/contracts/screenshots/sound-studio-orbit-threshold-mobile.png
experience_verification: >
  2026-11-17 local Chrome logic witness (tests/listening/orbit_threshold_browser_witness.cjs) on an isolated
  fixture that compiles the REAL PersistentListeningProvider with the real OrbitThresholdDesk and stylesheet
  (no Next, no session, no network). At 390 px nothing plays on arrival and nothing overflows. Begin plays through
  the one player (the dock shows the study). Simulated Space-key breaths walk the founder route up the back in
  order (sacrum, kidneys, heart, base of neck, base of skull, crown, third eye). Pause holds the place and Resume
  continues from it, including a breath released while paused. The sound continues while another room is shown,
  and the desk re-attaches on return. Armed, the third eye opens Threshold → The line → Silence → End, after which
  the player pauses itself and releases the output. Begin again starts at the perineum; Stop clears the dock; the
  lineage route rises first to Huiyin; no page errors. Sequencing, single-authority and copy rules are pinned by
  tests/listening/orbit_threshold.test.mjs. This is a logic witness, NOT a listening witness: no audible or
  measured level check, no headphone, Safari, iPhone or screen-lock test, and no authenticated walk of /listen.
  Founder felt acceptance (W1), teacher review of the routes and wording, and release are separate and not claimed.
---

# Sound Studio / Orbit & Threshold — Experience Contract

## What this is for

The founder's own practice, made audible: the microcosmic orbit as they describe it. A spinning ball of fire about seven inches across rises up the back, one point per in-breath, and turns to water at the third eye. Water then flows down the front, one point per out-breath, and turns back to fire at the base. "The space between elements is as important as the rest", so at each point the ball holds, expands, and springs into the next element.

The threshold is optional. When the listener arms it, by hand or after 3, 5, 7 or 9 orbits, the next arrival at the third eye does not turn to water. A full field arrives all at once, gathers at the brow, narrows to a thin line, tunes and locks. Every sound then stops, and the silence is real. Afterwards the piece ends, or returns to the orbit after 30 or 60 seconds, as chosen beforehand.

It lives in the Lab because it is a study under review, not a finished work.

## Breath

- **Follow my breath** (the default) moves when the listener presses and releases: hold the button or Space while breathing in, let go while breathing out. Nothing measures breathing, and the page says so. If the listener stops pressing, the ball simply waits.
- **Guided** moves at set in- and out-breath lengths the listener chooses.
- Breaths at each point: 1 (default), 3, 5, 7 or 9.
- Breathing is natural throughout. There are no breath holds, no counts to keep and no pelvic-floor instruction.

## Routes

- **Founder's route** (default): perineum, sacrum, kidneys, heart, base of neck, base of skull, crown, third eye; then face, throat, heart, navel/dantian, perineum.
- **Lineage reference**: 15 stops, labelled everywhere as a synthesis of contemporary manuals, not a single prescribed Taoist sequence. It is pending review by teachers from at least two traditions.

## Safety

- Starts quiet, at the shared level. A note recommends headphones and a low level because the threshold arrives suddenly.
- The lock is an 8 ms fade to digital zero, never a click. After it, every source is stopped.
- Member-initiated only. Arriving plays nothing, and changing a setting starts nothing. One Soullab sound at a time, MAIA speech first, and nothing resumes by itself.
- A note says to return to ordinary breathing or stop if dizzy or tingling.

## Forbidden here

Any claim that the piece produces, imitates or induces a state, a realm, an entity or a substance experience. Any brain-rhythm, gland or healing language. Presenting the lineage route as authentic transmission. Breath holds. Autoplay. A second player or level control. Recorded media without rights admission. `tests/listening/orbit_threshold.test.mjs` enforces the copy and authority rules.

## Not in this change

No member access: the review flag and the named-member list are untouched. No recorded voice or habitat yet; the recording plan is a separate step. No saving of settings or sessions. No screen-lock keep-alive for iPhone. No analytics.
