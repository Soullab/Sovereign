---
room: Sound Studio / Shelf
human_activity: receiving a generated field, seeing that it is playing and what it is made of, tailoring it, and keeping the combinations that feel meaningful as go-to fields to return to
surfaces:
  - app/listen/ReceptiveFieldDesk.tsx
  - components/listening/PersistentListeningProvider.tsx
principles:
  - LISTEN-23 — receptive shaping of Soullab's own low-gain synthetic sketch only; never member files, provider music or recorded masters; no account persistence, recording, MAIA analysis or sync
  - SHELF LIVE VIEW APPROVAL 2026-11-19 (#1979) — a live view of the actual output, the field's notes and settings, the chosen card marked, through a read-only output tap; no change to the sound
  - AUDIO-PLATFORM-01 — the one persistent player; member intent governs start, pause and Stop
  - "No AI decides what a feeling means" — the words a member chooses never change the sound and are never read as a diagnosis
reference_surfaces:
  - docs/design/contracts/sound-studio-field.md — the same Sound Studio field, dock and level control
  - docs/design/contracts/sound-studio-transform.md — the same read-only pattern for showing what the one player is doing
shared_with_house: the deep contained field, editorial serif headings, restrained gold signal, plain human language, and the one persistent player
distinct_to_room: a generated sound has no file, so it is shown live as it is made, as a waveform drawn to its own size, its movement over the last ten seconds, its real output level and its notes; the card that is sounding says so
screenshot_desktop:
  - docs/design/contracts/screenshots/sound-studio-shelf-live-desktop.png
screenshot_mobile:
  - docs/design/contracts/screenshots/sound-studio-shelf-live-mobile.png
experience_verification: >
  2026-11-19 isolated browser witness (tests/listening/shelf_live_view_browser_witness.cjs), 52/52: the real
  ReceptiveFieldDesk inside the REAL PersistentListeningProvider, with their real stylesheets, in local Chrome at
  1440×1200 and 390×844. Before Play, the view says Not playing and no card is marked. Choosing a card marks only
  it. While playing, the card says Playing, the waveform moves, the real output level is shown, and the notes and
  settings appear. A different card shows different notes (G2 · D3 · G3 versus C3 · G3 · C4) and different
  settings, each in the field's own colour. Three lanes, one per note, are labelled with the dial that shapes
  each; raising Texture & stillness grows only the middle note,
  and raising all three dials grows all three lanes on screen (against the old auto-scale this check fails). Each lane shows a fixed 25 ms at the device's
  rate (192 kHz on the founder's Mac), about 6.5 cycles of C4. Tailoring marks the card "tailored". Paused, the view says Paused and goes flat. An audio-graph edge
  log shows the taps add exactly four edges (the output and its three voices, each from a gain node into an
  analyser), that no analyser feeds anything, and that only one
  path reaches the speakers. No overflow, no page errors and no outside requests. Before the overtones, "A
  wider horizon" played at about −53 to −55 dBFS RMS at the default level. Re-run after the overtones: still 52/52.
  Overtones (2026-11-19): captured from the real player at Level 45%, The Blue Hour measures −45.9 LUFS overall
  and −53.1 LUFS above ~300 Hz (before: −53.8 and below −69). This matches the listening A/B the founder approved
  (#1979 comment 7021180314). tests/listening/shelf_dial_pops_browser_witness.cjs, in local Chrome and Playwright
  WebKit 26.0, finds no clicks while each dial moves. The fixture mirrors the app shell's
  button reset, which it does not load. This is a fixture witness, not an authenticated walk of /listen and not
  the founder's listening.
---

# Sound Studio / Shelf — Experience Contract

## What this is for
A member wants to receive a generated sound field, shape it if they wish, and keep the versions that matter to them. Today they could not tell whether anything was playing, or how one field differed from another.

## What the member can always rely on
- **They can see that it is working.** While their field plays, a live view moves with the actual sound: the waveform itself, how it swells over the last ten seconds, and its real output level. Paused, it says so and goes flat.
- **They can see what they are hearing.** The field's notes (for example G2 · D3 · G3) and its Organic Current, Open Water and Texture settings are shown, so different cards read differently.
- **Each field has its own colour.** Lavender for A place to center, amber for A moving current, sea for A wider horizon, and rose for Room for catharsis. The chosen card and its live view take that colour; with no card chosen the view stays in house gold. The lines are soft, with a blurred halo under a thin line, rather than severe (founder, 2026-11-19).
- **They can see the three notes.** Each field is three notes, and each dial shapes one of them: Organic Current the lowest (and its swell above 50), Texture & stillness the middle, Open Water the top (and the shared filter). The live view draws one lane per note on one FIXED scale (the loudest a voice can be), so raising any dial, or all three, always grows its note on screen, labelled with its note and dial, so moving a dial visibly grows or fades its own note (founder, 2026-11-19). Each lane shows a fixed 25 ms of time, whatever the device's sample rate.
- **They know which card is sounding.** The chosen card is marked Chosen, then Playing, then "tailored" once a dial moves away from the card's own setting.
- **Speakers can carry it.** Each note carries soft overtones: quiet copies at exact whole-number multiples of its own pitch (2× to 8×), so they blend into the same tone and never add a note or change the pitch. They follow their note's dial and swell, Open Water brightens them, and the one Level governs them. This is how laptop and phone speakers, which barely play the low notes themselves, carry the field (founder, 2026-11-19: "I like the overtones option!", then "Yes, at 100%").
- **Seeing changes nothing.** The view reads the one player's output through a tap that feeds nothing. It does not change the sound, its level or its notes, and it adds no control to the player bar.

## What the Shelf never does
- Store anything on a server, record sound, or read a member's words as meaning.
- Change the sound in order to show it.

## Known, not addressed here
- The fields stay quiet overall: about −46 LUFS at the default level, against about −14 to −16 for typical music. The level ceiling (GENERATED_OUTPUT_SCALE, 0.027) has no recorded reason and is unchanged. Raising it is a separate decision, and it would also change Focus Field soundscapes and every member's remembered level.
- Small pops while moving the sliders (founder, 2026-11-19) were not reproduced in Chrome (48 and 192 kHz) or WebKit, and the founder later heard them gone. Real Safari through real speakers is covered only by the founder's ear. The pops script detects clicks reliably only for Organic Current, because the shared filter rounds the others off.
