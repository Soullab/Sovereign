---
room: Sound Studio / Lab / Tone Lab
human_activity: listening to a single pure tone, and if they choose a slow pulse, to hear what it is like; exploring pitch and rhythm rates by ear, with an honest account of where each well-known number comes from
surfaces:
  - app/listen/ToneLabDesk.tsx
  - lib/listening/toneLab.ts
  - lib/listening/soundscapeEngine.ts
  - lib/listening/focusSoundscape.ts
principles:
  - MARKETING_CLAIM_DISCIPLINE — Live / Designed / Vision and the Failure Test. Tone Lab claims an instrument, never an effect; every preset says where it comes from and what is not known
  - MAIA_CANON v1.1 — reflection, never authority; no guru stance; MAIA does not tell a person what a sound will do to them
  - AUDIO-PLATFORM-01 — member intent governs start, pause, resume and Stop; one Soullab sound at a time; no automatic restart; MAIA speech takes priority
  - SOULLAB-CONTINUITY-01 / LISTEN-01 — the one existing player, level control and Stop; Tone Lab adds no second player and no second level
  - SOUND_AND_CONSCIOUSNESS_RESEARCH_2026-11-09 — rhythmic sound produces a measurable sensory response; that a tone or pulse changes a person's state is not established; Solfeggio, 432 Hz and Schumann health claims rest on numerology or myth
reference_surfaces:
  - docs/design/contracts/sound-studio-field.md — the same field, player, level control and Stop
  - docs/design/contracts/house-room.md — quiet thresholds, no optimization pressure
shared_with_house: the same deep contained field, editorial serif headings, restrained gold signal and plain human language; the same persistent player bar carries the sound
distinct_to_room: a dial rather than a destination. The member sets a pitch and, optionally, a pulse and a soft bed, and listens. The room names the traditions honestly instead of translating them into Soullab vocabulary
screenshot_desktop:
  - docs/design/contracts/screenshots/sound-studio-tone-lab-desktop.png
screenshot_mobile:
  - docs/design/contracts/screenshots/sound-studio-tone-lab-mobile.png
experience_verification: >
  2026-11-15 isolated fixture witness (tests/listening/tone_lab_fixture_witness.cjs): the real ToneLabDesk
  component compiled with its real stylesheet, the persistent player replaced by a recording shim, walked in
  local Chrome at 1440×1000 and 390×844. Nothing plays on arrival; the plain statement that no effect is claimed
  is the first thing read; choosing 528 Hz shows its provenance and no outcome; a typed pitch of 5000 clamps to
  1000; choosing Binaural reveals the headphones note and the driving note stays visible; Play hands exactly
  the dial to the one player (a slow fade, never a cut); moving the pulse while playing is clamped to 40 Hz;
  Stop reaches the player; no horizontal overflow and no page errors at either size (28/28). This is a fixture
  witness, not an authenticated walk of /listen, not an audible or measured level check on a device, and not a
  physical phone or headphone test. Founder felt acceptance of the exact instrument, physical device and
  headphone qualification, and release remain separate and are not claimed.
---

# Sound Studio / Tone Lab — Experience Contract

## What this is for

Tone Lab is an instrument for listening and exploring. A member sets a pitch between 40 and 1000 Hz, may add a slow pulse between 0.5 and 40 Hz, may place a soft bed underneath, and listens. It is the Lab door of Sound Studio, beside the studies already there.

It is never a remedy. Nothing in it says or implies that a pitch or a pulse changes how a person feels or what their body does. The research behind this room (`docs/research/sound/SOUND_AND_CONSCIOUSNESS_RESEARCH_2026-11-09.md`) found that rhythmic sound produces a measurable sensory response and that nothing more specific is established. Tone Lab says exactly that, and no more.

## The honest labels

Every starting point carries one line saying where the number comes from and what is and is not known. The member can read it before and while listening, and the line is replaced by "Your own setting" the moment they change the dial.

- The nine Solfeggio numbers (174, 285, 396, 417, 528, 639, 741, 852, 963 Hz) are named as a tradition from Joseph Puleo in the 1970s, derived by numerology. The room says many people find them meaningful and that there is no evidence of a physical effect.
- 432 Hz is an alternative tuning; claims about it are not supported. 440 Hz is named as a convention.
- The Schumann 7.83 Hz pulse is real geophysics; health claims linking it to the body have no support.
- Theta 6, alpha 10, beta 16 and gamma 40 Hz are rhythm rates named for brainwave bands. Each says it produces a measurable sensory response, is not proven to change a state, and that no outcome is claimed.

The traditions are named, not translated. The room does not decide what they mean to the person.

## Safety

- Starts quiet. The shared level in the player bar is the only level control; Tone Lab plays at no more than 40 on that level, however high it is set.
- Fades in slowly and out gently. Stop is terminal.
- A headphones note appears whenever Binaural is chosen. A note against use while driving or operating machinery is always shown.
- Sound only. Nothing on the screen flashes, pulses or animates.
- Member-initiated only: choosing a starting point or moving the dial starts nothing. Play is the member's own act. A sound that is not playing is never started by a change to the dial.
- One Soullab sound at a time, through the one persistent player. MAIA speech takes priority and nothing resumes by itself afterward.

## Forbidden here

Remedy language of any kind; promises about mood, sleep, focus, the body or consciousness; the other words in `BANNED_TONE_WORDS` (the list lives in code, so this page does not repeat them); any second player, second level control or autoplay; any visual flicker; and any claim that a Solfeggio, 432 Hz, Schumann or 40 Hz setting has a proven effect. The list is enforced by `tests/listening/tone_lab.test.mjs`, which also fails if the level cap or a provenance label is removed.

## Not in this change

No saving, sharing or history of settings; no timer; no new rooms; no analytics on what a member plays. Fade on Pause is not added; Stop and the dial changes are smooth, Pause uses the existing player behavior.
