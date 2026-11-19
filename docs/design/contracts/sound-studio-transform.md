---
room: Sound Studio / Studio / Transform
human_activity: shaping a recording of their own — trimming, fading, evening its level, reversing or looping it, joining two, tuning its tone, giving it a space — hearing the result in the one player, and keeping it as a new file while the original stays exactly as it was
surfaces:
  - app/listen/TransformDesk.tsx
  - app/listen/ListenRoom.tsx
  - components/listening/PersistentListeningProvider.tsx
  - lib/listening/transform/recipe.ts
  - lib/listening/transform/audio.ts
  - lib/listening/transform/wav.ts
  - lib/listening/transform/nodes.ts
  - lib/listening/transform/impulses.ts
  - lib/listening/transform/render.ts
  - lib/listening/transform/provenance.ts
principles:
  - FOUNDER RULING 2026-11-17 (#1979 comment 6963607549) — the member's OWN audio may be processed and saved on their device as new derived takes with provenance; catalogue and Soullab works stay un-transformable until an independent rights authority exists
  - TRANSFORM T1 APPROVAL (#1979 comment 6964484327) — Web Audio built-ins only, offline, 20-minute cap, browser download, original never modified, nothing uploaded
  - AUDIO-PLATFORM-01 / SOULLAB-CONTINUITY-01 — the one persistent player, level control and output lock; Transform renders silently offline and hands the result to that player; no second player
  - MARKETING_CLAIM_DISCIPLINE — the desk describes what it does to the sound, never what the sound will do to a person
reference_surfaces:
  - docs/design/contracts/sound-studio-tone-lab.md — an instrument that claims nothing, controls laid out as labelled number fields
  - docs/design/contracts/sound-studio-field.md — the same field, player, level control and Stop
shared_with_house: the deep contained field, editorial serif headings, restrained gold signal, plain human language; the same persistent player carries every preview
distinct_to_room: a workbench rather than a destination — an ordered list of steps that runs top to bottom, a waveform of the member's own file with a time ruler, where Trim and Fade are marked and dragged, and a save that always makes something new and then proves the original is untouched
screenshot_desktop:
  - docs/design/contracts/screenshots/sound-studio-transform-desktop.png
screenshot_mobile:
  - docs/design/contracts/screenshots/sound-studio-transform-mobile.png
experience_verification: >
  2026-11-17 isolated browser witness (tests/listening/transform_t1_browser_witness.cjs), 72/72: the real
  TransformDesk compiled with its real stylesheet, the persistent player replaced by a recording shim, in
  local Chrome at 1440×1100 and 390×844. A non-audio file is refused; a 24-bit stereo WAV with a BWF bext
  chunk (a Capture take's shape) opens with its waveform; trim, fade, EQ, reverb and normalize are added and
  run in order; the waveform carries a time ruler, Trim and Fade read as times on the recording (m:ss.cc),
  dragging a handle on the waveform moves the trim end, and a typed time sets the fade; Play the original
  hands the original to the one player, a playhead follows its reported position, and Start here marks the
  trim there; after Preview the result's own waveform appears and the playhead follows it there; Preview hands exactly one WAV to the one player; Save as new downloads a new WAV and its
  provenance, whose source hash equals the original's and whose output hash equals the saved file's; the
  saved WAV also carries the same record inside it, its audio hash matches the saved samples, and Chrome's
  decoder and macOS Core Audio both read it; the
  original on disk is byte-identical and the desk re-reads it and says "unchanged"; output stays 44.1 kHz;
  no horizontal overflow and no page errors at either size. The same run measures the shaping steps in
  Chrome's own OfflineAudioContext: EQ bands within ±0.2–0.6 dB of target, high- and low-pass below −30 dB
  a decade out and within ±0.5 dB in the passband, reverb deterministic with its tail appended, and the
  sample rate kept. The edit steps are exact to the sample in tests/listening/transform_t1.test.mjs. This is
  a fixture witness, not an authenticated walk of /listen and not the founder's listening, which is recorded
  separately on #1979.
---

# Sound Studio / Studio / Transform — Experience Contract

## What this is for
A member has a recording of their own — a Soullab Capture take, a voice memo, a file they made — and wants to shape it: cut it to length, smooth its edges, even out its level, change its tone, give it a room, loop it, join it to another. They want to hear the result before keeping it, and to keep it without losing the original.

## What the member can always rely on
- **Their original is never changed.** Every save makes a new file. After saving, the desk re-reads the original and says whether it is unchanged.
- **Nothing leaves the device.** Shaping happens in the browser; saving is a download.
- **It says what was done.** Every new WAV carries its provenance inside it: the original's fingerprint, every step and setting in order, and the fingerprint of the new audio. A provenance file beside it says the same and adds the fingerprint of the whole saved file, so the record survives even if the browser blocks the second download.
- **Only their own recordings.** Soullab and catalogue recordings cannot be opened here.
- **One player.** Preview plays in the same player as everything else in Sound Studio.
- **Honest limits.** Up to 20 minutes. Recordings with different sample rates are not joined (nothing is resampled silently). A WAV keeps its own sample rate; other formats are decoded by the browser at 48 kHz and the provenance says so.

## Marking times
- The waveform has a ruler of round times under it, and is drawn to the recording's own loudest point so a quiet take is readable. This changes the picture only, never the sound.
- Selecting a Trim or Fade step marks it on the waveform: trim start and end as handles with the cut parts dimmed; fades as ramps, with a handle where the fade in ends and one where the fade out begins. Dragging a handle and typing a time do the same thing.
- Times are written as times on the recording (0:01.20), never as bare seconds. The length of each fade is shown beside it.
- After a step that changes the recording's length or direction (reverse, loop, join, reverb), a later Trim or Fade works on the changed recording, so it is not marked on this waveform and the desk says so.
- **Play the original** plays the member's file in the one player. While it plays, a playhead follows it on the waveform with its time, and each Trim or Fade step offers **Start here / End here** or **Fade in until here / Fade out from here** at that time.
- **Preview** plays the result. Its own waveform appears below, with its own ruler, because after a trim or a reverb the result's times are not the original's, and the playhead follows the preview there.
- The playhead reads the one player's position through `localFilePosition()`: read-only, for the member's own local file only, with no new control and nothing new on the player bar. Founder ruling 2026-11-19 (#1979).

## What the desk never does
- Upload, analyse, or store anything on a server.
- Claim an effect on mind or body.
- Offer pitch or time-stretch, granular textures, or live effects (later stages, separately authorized).

## Copy
- Eyebrow: "TRANSFORM · YOUR OWN RECORDINGS · ON THIS DEVICE". Heading: "Shape a recording".
- After saving: "Saved <file> and <provenance>. The same record is also inside the WAV. Your original was re-read after saving: unchanged."
