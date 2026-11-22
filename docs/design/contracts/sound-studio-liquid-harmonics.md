---
room: Sound Studio / Lab / Liquid Harmonics
human_activity: steering a living, liquid sound field by hand (voice, throb, frequency-shifted echoes, spiral, pressure and space), keeping the settings that feel right, and writing a journey that morphs between them and rises, accelerating, to a breakthrough of stillness or silence
surfaces:
  - app/listen/LiquidHarmonicsDesk.tsx
  - lib/listening/liquidHarmonics.ts
  - lib/listening/proceduralStudy.ts (unchanged; from the Orbit & Threshold review branch)
principles:
  - MARKETING_CLAIM_DISCIPLINE — an artistic sound study for review; no state, effect or health outcome is claimed, and nothing says it imitates or induces any experience or substance
  - MAIA_CANON v1.1 — reflection, never authority; the room never tells a person what they will feel or what a feeling means
  - AUDIO-PLATFORM-01 — member intent governs start, pause, resume and Stop; one Soullab sound at a time; MAIA speech takes priority; nothing restarts by itself
  - SOULLAB-CONTINUITY-01 / LISTEN-01 — the one existing player, level control, dock and Stop; the study adds no second player, no second level and no recorded media
  - Founder go-ahead 2026-11-21 ("Yes, review branch") — review-only branch; the review flag, member access, merge and deployment stay held
  - Founder rules carried from the local sketches — a rise always goes through (no fake-outs), Stop always works, nothing autoplays, the level is the listener's
  - Journey Player 0.1 boundary (relayed 2026-11-21) — no AI composition; the score validates its own ranges and transitions so no future composer can bypass them
reference_surfaces:
  - docs/design/contracts/sound-studio-orbit-threshold.md — the neighbouring Lab study and the procedural-study path it introduced
  - docs/design/contracts/sound-studio-tone-lab.md — the Lab's honesty about claims
shared_with_house: the same deep contained field, editorial serif headings, restrained gold signal and plain language; the same persistent player bar carries the sound, its Level, Pause and Stop
distinct_to_room: an instrument rather than a piece. Thirty-six field controls in six groups, plus a two-control music layer the listener balances, a live spectrum in the house gold, and a journey written as a plain list of steps the listener can read, edit, save and load
screenshot_desktop:
  - docs/design/contracts/screenshots/sound-studio-liquid-harmonics-desktop.png
screenshot_mobile:
  - docs/design/contracts/screenshots/sound-studio-liquid-harmonics-mobile.png
experience_verification: >
  2026-11-21 local Chrome logic witness (tests/listening/liquid_harmonics_browser_witness.cjs, 9/9) on an isolated
  fixture compiling the REAL PersistentListeningProvider with the real LiquidHarmonicsDesk and stylesheet (no Next,
  no session, no network). At 390 px nothing plays on arrival and nothing overflows. Begin plays through the one
  player (dock PLAYING; the study's analyser shows energy). A slider and Gather act on the running engine. A hostile
  score file is clamped (peak 9999→60, length 1→30, pitch 99→24, unknown step dropped). A journey rise only climbs
  (throb 3.0 → 16.0 /s, accelerating) with Hold / Extend / Next locked; the breakthrough measures zero energy; the
  next step brings the sound back; End lets the study end itself and the player pauses; Begin again plays; Stop
  clears the dock; no page errors. Score, takeoff and authority rules are pinned by
  tests/listening/liquid_harmonics.test.mjs. This is a logic witness, NOT a listening witness: no audible or
  calibrated level check, no headphone, subwoofer, Safari, iPhone or screen-lock test, and no authenticated walk of
  /listen. The founder's felt acceptance of this port (that it sounds as the local sketch did) is separate and not claimed.
  2026-11-22 addition (founder request after first listening: "it doesnt show below the arc of the journey"): a journey
  timeline under Begin / Play. The same witness, now 10/10, checks one segment per step and no playhead before playing; the
  playhead only moves forward (0.11 → 0.86 of the journey); and the line names the step ("Step 2 of 4 · Rise · … · rising",
  then "Step 3 of 4 · Gather"). There is still no overflow at 390 px. The controls under the timeline start the journey; both Play
  buttons lock while it plays; Hold works during a morph and is locked during the rise, top and bottom. Logic witness only.
  2026-11-22 music layer (founder: "Yes, prototype it"):
  - Witness 11/11: off by default; music alone is heard; the desk names the key; with the music at 0.5, the
    breakthrough still measures energy 0; a journey leaves the listener's balance at 0.50.
  - Unit tests 8/8: every reachable note is a major-pentatonic degree of the field's own fundamental; journey morphs
    drop the music keys; it is sparser in a rise.
  - Loudness, measured on the study analyser at founder defaults: field alone about −6 dB RMS; music alone about
    −16 dB RMS, with peaks about −2 dB (after a +17 dB make-up). The felt balance is not witnessed.
---

# Sound Studio / Liquid Harmonics — Experience Contract

## What this is for

The sound the founder has been steering toward in the Alchemy of Sound studies: "more viceral", "more multitonal", "whole being sound", moving "from peripheral to central". A voiced tone with a vowel inside it and a singing overtone that steps through the harmonics. A throb and pitch wobble from one oscillator. Echoes that shift every partial by a fixed number of hertz, so the sound spirals up or down. An endless Shepard–Risset spiral, glass shimmer, rotation, space, and a mono sub-bass pressure for speakers. Defaults are the founder's own settings from 21 Nov 2026 (sawtooth throb).

It lives in the Lab because it is a study under review, not a finished work.

## Moving it

- **Gather / Release** move the field to one central point or back out to the periphery over 10 seconds.
- **Begin the rise**: throb rate and depth climb to a chosen peak over 30 s to 5 min, the body thickens, and the field gathers. It ends in stillness, in silence, or in a small pop and then stillness. A rise cannot be cancelled except by Stop. **Return** brings the sound back to where it was over 30 seconds.
- **Keep** a setting by name. Kept settings stay in this browser on this device and can be saved as a file.

## Journeys

A journey is a score the listener writes: morph to a kept setting, gather, release, rise, end. Each rise has takeoff controls: pitch climb (up to two octaves), harmonics emerging, voice → digital, and separate acceleration for throb, pitch and harmonics (1 steady, 5 sudden takeoff). Hold here, Extend +30 s and Next step work between rises, never during one. A score can be saved and loaded as a plain file.

Every score passes through `cleanScore` before it plays: every value is clamped to its control's range, transitions have minimum lengths, unknown keys and steps are dropped, and a score is capped at 40 steps and two hours. Whoever or whatever wrote it, the player keeps it within these limits. The starter score is labelled as a template written by Claude, not as the founder's composition.

## Following a journey

A timeline sits under Begin and Play. It has one band per step, each as wide as its share of the time and named (a morph by its setting's name). It previews a loaded score before it plays. While a journey plays:
- a playhead moves along the band;
- a line reads "Step n of N · name · elapsed / total", adding held, rising or fading where that applies;
- Hold, Extend and Next change how long a step actually takes, and the band stretches or shrinks to match.

The band itself is not a control. Right under it are the four journey controls: Play journey, Hold here, Extend +30 s and Next step. They are the same controls as at the foot of the Journey panel, so a journey can be followed and steered without scrolling. While a journey plays, both Play buttons read "Journey playing" and are visibly greyed; during a rise, Hold, Extend and Next are greyed in both places. The playhead's motion respects reduced-motion settings.

## Music layer

A melody above the field, so attention has something human to rest on while the field carries the body. Both layers are always audible and the listener sets the balance (Field ↔ music: 0 the field alone, 0.5 both in full, 1 the music alone). It is off until the listener raises it, and **journeys never change it**.
- **In key.** The root is the field's fundamental, snapped to the nearest semitone, so every note is a major-pentatonic degree consonant with the drone.
- **It follows the journey:**
  - sparse and lower where the field is heavy (more sub, less glass);
  - flowing where the field moves (vowel drift, rotation, swirl);
  - spread left and right with the rotation;
  - ducked and sparser during a rise;
  - silent in a silence breakthrough, because it runs through the same presence, limiter and fades.
- **It is synthesized**: soft sine-and-triangle bells with their own echo and hall. There are no recordings and no second player.
- **No claim** is made that the layering does anything. It is offered as music.

## Safety

- Member-initiated only. Arriving plays nothing; changing a setting or loading a score starts nothing.
- The study's own output trim and limiter sit under the shared player level. A note recommends a low start, because a rise grows faster, brighter and fuller and the breakthrough can be sudden silence. Silence is an 8 ms fade to digital zero, never a click.
- Sub-bass pressure carries a note to raise it slowly and keep the room level sensible.
- One Soullab sound at a time, MAIA speech first, nothing resumes by itself. End lets the study end itself; the player pauses and releases the output.

## Forbidden here

Any claim that the sound produces, imitates or induces a state, a realm, an entity or a substance experience. Any brain-rhythm, gland or healing language. Frequency recipes ("X Hz does Y"). AI-composed journeys. Autoplay. A second player or level control. Recorded media without rights admission. `tests/listening/liquid_harmonics.test.mjs` enforces the copy, score and authority rules.

## Not in this change

No member access: the review flag and the named-member list are untouched. No recorded media (Study 01/02 audio and the founder's HUSO reference files stay outside). No AI composition, no Hugging Face generation. No server storage of settings or scores. No cymatic, somatic or physiological capture. No screen-lock keep-alive for iPhone. No analytics.
