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
  2026-11-22 touch, Phase 1 (founder: "Yes, start Phase 1"; Tactile Field design brief):
  - Witness 12/12: touch is zero until raised; at full level all four zones carry signal (RMS about 0.33); with the
    music layer on, 0.11% of touch energy is above 150 Hz (the filter's slope); gathered, left and right stay equal;
    released, the upper zones swing left and right (about −0.45 to +0.45); touch is silent at a silence
    breakthrough; a journey leaves the touch level unchanged.
  - Unit tests 9/9: carrier 40–120 Hz; rate cap 20/s; the curve never exceeds the 0.5 ceiling; no music node
    connects to touch; touch is not routed to any output.
  - Preview only. No device, transducer or body.
  2026-11-22 atmosphere (founder: "Lets build a bit more into it. not too much, atmospheric, and transportive"):
  - Witness 13/13: the air and swell controls act on the running engine; with both at 0.8 the silence breakthrough
    still measures energy 0.
  - Unit tests 10/10: the noise is bounded and deterministic; the swell chord is on the field's own fundamental;
    journeys may shape the atmosphere within range; no atmosphere node feeds touch.
  - Level under the Spiral's Arrival settings: −19.3 dB RMS without atmosphere; −17.6 with air 0.8; −16.4 with
    swell 0.8. These are 5-second windows of a slowly breathing layer, so they are approximate. Felt effect not witnessed.
  2026-11-22 extra loudness (founder: "volume could be louder option"):
  - Witness 14/14: at the +9 dB maximum the output averages 7.0 dB louder, and its peak is 0.940, exactly at the 0.94
    ceiling. A first attempt using 4x oversampling overshot to 1.15; 'none' holds.
  - Unit tests 11/11: the ceiling curve is transparent below 0.7, monotonic and never above 0.94; journeys never set
    the boost.
  - The ceiling also removes the earlier overshoot at no boost: the compressor's make-up had let peaks reach about
    +0.6 dBFS after the trim.
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

## Atmosphere

Two quiet, cinematic layers sit inside the field, outside the throb, so they stay wide and still while the voice pulses:
- **Air and distance:** a soft wash of pink noise in two independently sweeping bands, like wind or far surf, sent mostly to the hall.
- **Cinematic swell:** a warm low chord on the field's own tone (an octave below, a fourth below, the root, a fifth above) whose filter slowly opens and closes.

**Breathing** sets how slowly both rise and fall; the default is about one swell every 17 seconds.

Because the atmosphere is part of the field:
- journeys can shape it, within its ranges;
- the field ↔ music balance and the presence apply to it, so it falls silent with a silence breakthrough;
- it never reaches touch.

It is inspired by long-form atmospheric listening, but borrows no recordings, scripts, level names or methods from any existing program, and makes no claim.

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

## Touch (Phase 1 preview)

Four touch channels are worked out from the field and measured on the desk:
- **Lower left and right** carry the sub-bass pressure.
- **Upper left and right** carry a felt throb (the field's fundamental folded into 40–120 Hz). It swings left and right with the rotation, and gathered it holds both sides equal.

They are **not sent to any device**. That is Phase 2, a bench test with nobody on it, under the design brief. The listener's own Touch level starts at 0, fades in over about 3 seconds, and journeys never change it.

Fixed in code, on every channel:
- a 20 Hz high-pass;
- a 150 Hz low-pass before and after a soft ceiling of 0.5;
- a pulse rate of at most 20 per second;
- the same presence as the sound, so silence, fades and the end apply to touch too.

The music layer has no path to touch.

## Loudness

**Extra loudness** (0 to +9 dB, default 0) raises the whole study above the player's Level, for listeners who find the top of the Level not loud enough. It belongs to the listener and journeys never change it.

The study's output passes through a ceiling: transparent below 0.7, rounding off smoothly toward 0.94 (about −0.5 dBFS), and never above it. At high boost, loud passages are therefore compressed, not distorted.

The safety note still asks for a low start.

## Safety

- Member-initiated only. Arriving plays nothing; changing a setting or loading a score starts nothing.
- The study's own output trim and limiter sit under the shared player level. A note recommends a low start, because a rise grows faster, brighter and fuller and the breakthrough can be sudden silence. Silence is an 8 ms fade to digital zero, never a click.
- Sub-bass pressure carries a note to raise it slowly and keep the room level sensible.
- One Soullab sound at a time, MAIA speech first, nothing resumes by itself. End lets the study end itself; the player pauses and releases the output.

## Forbidden here

Any claim that the sound produces, imitates or induces a state, a realm, an entity or a substance experience. Any brain-rhythm, gland or healing language. Frequency recipes ("X Hz does Y"). AI-composed journeys. Autoplay. A second player or level control. Recorded media without rights admission. `tests/listening/liquid_harmonics.test.mjs` enforces the copy, score and authority rules.

## Not in this change

No member access: the review flag and the named-member list are untouched. No recorded media (Study 01/02 audio and the founder's HUSO reference files stay outside). No AI composition, no Hugging Face generation. No server storage of settings or scores. No cymatic, somatic or physiological capture. No screen-lock keep-alive for iPhone. No analytics.
