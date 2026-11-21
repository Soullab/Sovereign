---
room: Sound Studio / Lab / Drone
human_activity: turning a short steady passage of their own recording — a voice, an instrument, a place — into a sustained, living drone; choosing its character, tuning and placing its three voices, bringing them in slowly, placing elements around the head for headphones, hearing it in the one player, and keeping it as a new file while the original stays exactly as it was
surfaces:
  - app/listen/DroneDesk.tsx
  - lib/listening/drone/drone.ts
  - lib/listening/drone/detail.ts
principles:
  - FOUNDER RULING 2026-11-17 (#1979 comment 6963607549) — the member's OWN audio may be processed and saved on their device as new derived takes with provenance; catalogue and Soullab works stay un-transformable until an independent rights authority exists
  - TRANSFORM T2 R2 APPROVAL 2026-11-21 ("Approve T2 R2") — the founder-accepted Voice to Drone Lab v0.3.4 engine (revision 2), copied verbatim; every new control in a later step defaults to the accepted sound; step A (this desk, existing controls only) before step B (Resonance & Detail)
  - FOUNDER LISTENING 2026-11-21 — "they are all phenomenal!"; REFINE — "we need to be able to dial into the sound field or note so that the reverb or anomalies can be dialed in" (step B); an anomaly is not a defect by default
  - AUDIO-PLATFORM-01 / SOULLAB-CONTINUITY-01 — the one persistent player, level control and output lock; the drone is rendered silently on the device and handed to that player; no second player
  - MARKETING_CLAIM_DISCIPLINE — the desk describes what it does to the sound, never what the sound will do to a person; nothing here claims an effect of vowels, drones or 432 Hz on mind or body
  - FOUNDER DIRECTION 2026-11-21 — "432 should be standard": the desk opens at A = 432 Hz (STANDARD_A_REF), an aesthetic tuning standard, never presented as a health or consciousness claim; A = 440 stays one choice away, and the reference alone never changes the sound (only Fine tune and Snap do)
reference_surfaces:
  - docs/design/contracts/sound-studio-tone-lab.md — the Lab's instrument that claims nothing, beside which this desk sits
  - docs/design/contracts/sound-studio-transform.md — the same member-file rule, waveform, save-as-new and provenance discipline
shared_with_house: the deep contained field, editorial serif headings, restrained gold signal, plain human language; the same persistent player carries every preview
distinct_to_room: an instrument rather than a workbench — a passage marked on the member's own waveform becomes one held sound; character presets, three named voices with interval, entry and bloom, a headphone field, and a save that always makes something new and proves the original untouched
screenshot_desktop:
  - docs/design/contracts/screenshots/sound-studio-drone-desktop.png
  - docs/design/contracts/screenshots/sound-studio-drone-detail-desktop.png
screenshot_mobile:
  - docs/design/contracts/screenshots/sound-studio-drone-mobile.png
  - docs/design/contracts/screenshots/sound-studio-drone-detail-mobile.png
experience_verification: >
  2026-11-21 isolated fixture witness (tests/listening/drone_t2_browser_witness.cjs), 42/42: the real DroneDesk
  compiled with its real stylesheet, the persistent player replaced by a recording shim, walked in local Chrome at
  1440×1100 and 390×844. Nothing reaches the player on arrival; a non-audio file is refused; the member's own WAV
  opens with a 3-second passage marked; Deep Earth names its voices; Solo is a pressed toggle; Read the note finds
  196 Hz (G3); the drone goes to the ONE player as a WAV, and Chrome's render is bit-identical to the same render
  under Node; save makes a new WAV whose embedded provenance names the accepted engine and the source hash, the
  saved audio is the drone that was heard, the original is re-read unchanged; the recipe saves and loads back; no
  horizontal overflow, no page errors, no network. Engine parity: the 8 founder-accepted drones re-render
  bit-identically (tests/listening/drone_t2_parity.test.mjs). This is a fixture witness, not an authenticated walk
  of /listen, not Safari, not a physical headphone test; the founder's walk with their own recording is the
  step A acceptance and is not claimed here.
  Step B (Resonance & Detail, founder "Yes, start step B", 2026-11-21), same witness, now 72/72: with nothing moved the
  desk says it is the accepted v0.3.4 sound and renders bit-identically; the Detail meter reports flutter, seam and
  beating, with Listen (an excerpt in the one player), Reduce, Keep (changes nothing) and Bring forward; Read the note
  marks harmonics on the spectrum and a click places the resonance band (at 0 dB still the v0.3.4 sound); Hear only the
  band, and Compare original passage / v0.3.4 sound / your settings, each loudness-matched, all go to the one player; a
  lifted band and moved Decay change the drone and mark the last one out of date; the saved WAV records the detail and
  the derived engine; "Back to the v0.3.4 sound" returns the bit-identical accepted drone. engine3 (derived from the
  accepted engine by six counted patches) renders the 8 founder-accepted drones bit-identically
  (tests/listening/drone_t2b_detail.test.mjs). The founder's listening walk of step B is not claimed here.
---

# Sound Studio / Lab / Drone — Experience Contract

## What this is for

A member brings a short, steady passage of their own sound and hears it become a held, living drone, through the
engine whose sound the founder accepted. It is an instrument: the member shapes, listens, and keeps what they made.

## What the member can always rely on

- Only a recording they chose from their own device opens here. Soullab and catalogue recordings are refused.
- Everything happens on their device. Nothing is uploaded, analysed on a server, or stored by Soullab.
- They hear the drone in the one player, with its level control and Stop.
- Saving always makes a new file. Its recipe and provenance travel inside the WAV and beside it. The original is
  re-read after saving and the desk says whether it is unchanged.
- A saved recipe brings the same drone back.

## Resonance & Detail (step B)

- Every new control (Decay, Size, Wet, Dry, Tone, the resonance band) starts where v0.3.4 has it. While they all
  stay there, the desk says so and the accepted engine renders, unchanged. "Back to the v0.3.4 sound" is always one press.
- The Detail meter only reports. Nothing it finds changes unless the member chooses Reduce or Bring forward; Keep
  changes nothing. An anomaly is not a defect by default.
- Every listening aid (an excerpt, the band alone, the three-way compare) is a preview through the one player and is
  never saved.
- Harmonic emphasis is done with the resonance band placed on a marked harmonic, not by a separate per-voice engine.

## What the desk never does

- Record from a microphone (C2) or route live audio (C3).
- Ship or offer example voices or drones.
- Claim what a drone, a vowel or a tuning does to a person.
- Remove an anomaly on its own. Clean controls act only when the member moves them.

## Copy

"Make a drone" · "Open a recording of your own — a voice, an instrument, a place." · "Your original is never
changed and nothing is uploaded." · Align grains is labelled experimental, with what it can do to vibrato.
