---
room: MAIA Desktop / Soullab Capture window
human_activity: recording the sound of one app on their own Mac — choosing the app, seeing plainly that it is recording and whether sound is actually arriving, stopping, and knowing what was saved and why a recording ended
surfaces:
  - maia-desktop/src/capture.html
  - maia-desktop/src/capture-renderer.js
  - maia-desktop/src/capture-view.js
  - maia-desktop/src/capture-preload.js
principles:
  - SOULLAB-CAPTURE CONTRACT (packages/soullab-capture/CONTRACT.md) — one app at a time; nothing starts, resumes or retries by itself; audio is never deleted; the helper holds the recording and has no network or microphone
  - AUDIO-PLATFORM-01 — member intent governs start and Stop; no automatic restart
  - MARKETING_CLAIM_DISCIPLINE — say what is true. "Waiting for audio" is a state, not an error; an empty recording is labelled, not hidden
  - SOULLAB-CONTINUITY-01 — the existing MAIA Desktop and the existing Capture engine; no second application, recorder or playback engine
reference_surfaces:
  - maia-desktop/src/index.html — the same SOULLAB CORE token copy, the same restrained gold, the same plain controls
  - docs/design/contracts/sound-studio-tone-lab.md — an instrument that claims nothing, with honest provenance
shared_with_house: the deep contained field, an editorial serif headline, a restrained gold signal and plain human sentences; the same token copy MAIA Desktop carries from app/globals.css
distinct_to_room: a small tool window rather than a room. One red indicator that cannot be hidden while recording, a clock that admits when it has stopped moving, and one sentence for every way a recording can end
screenshot_desktop:
  - docs/design/contracts/screenshots/soullab-capture-window-first-run.png
  - docs/design/contracts/screenshots/soullab-capture-window-choose.png
  - docs/design/contracts/screenshots/soullab-capture-window-recording.png
  - docs/design/contracts/screenshots/soullab-capture-window-waiting.png
  - docs/design/contracts/screenshots/soullab-capture-window-ended-device.png
  - docs/design/contracts/screenshots/soullab-capture-window-permission.png
screenshot_mobile:
  - docs/design/contracts/screenshots/soullab-capture-window-recording-narrow.png
experience_verification: >
  2026-11-17 fixture witness (maia-desktop/scripts/capture-window-screens.cjs): the real capture.html,
  stylesheet, capture-view.js and capture-renderer.js rendered in Electron 44.4.1 with the bridge replaced
  by a fixed-state fixture, at 420×640 and at the 360×480 minimum window size. Six states: first run (no
  folder), choosing an app with the external-drive note, recording, waiting for audio (clock held still
  past 2 s), a recording that ended because the sound output changed, and macOS refusing permission.
  No horizontal overflow and no page errors in any state. Every sentence is unit-tested in
  maia-desktop/test/soullab-capture-window.test.mjs. Desktop-only: MAIA Desktop has no phone form, so the
  "mobile" image is the narrowest window. This is a fixture witness, not the founder's live walk, which is
  recorded separately on #1979.
---

# MAIA Desktop / Soullab Capture window — Experience Contract

## What this is for
A member wants the sound of one app — a track in QuickTime, a call, a browser tab — saved cleanly on their own Mac. The window lets them choose the app, see that it is recording, notice if nothing is arriving, stop, and find the file.

## What the member must always be able to tell
- **Whether it is recording.** A red dot and a red Stop button are present for the whole recording, including while starting and while waiting. Closing the window does not stop a recording; the Capture menu keeps Stop available.
- **Whether sound is arriving.** If the clock has not moved for two seconds, the window says "Waiting for audio from <app>" in amber — a state, not an error.
- **Why it ended.** One sentence for each reason: you stopped it; the app quit; the sound output changed; the Mac slept; MAIA closed. A self-ended recording always says it did not restart.
- **What was saved.** The file name, length, sample rate and gaps, with Show in Finder. An empty recording is labelled ("Nothing was recorded — <app> wasn't playing"), never hidden or deleted.

## What the window never does
- Start, resume or retry a recording by itself. Choosing an app is the only start.
- Show where files live beyond the folder's name. Show in Finder is done by MAIA, not by the page.
- Offer system audio daemons as something to record.
- Make claims about the sound. It records; it does not judge.

## Copy
- Headline at rest: "Record one app". Detail: "Choose an app that is playing. Only that app's sound is recorded, until you stop."
- Starting: "Starting to record <app>…" / "If macOS asks, choose Allow. Nothing is recorded until you do."
- External drive: "This folder is on another drive. macOS will also ask to let Soullab Capture use it."
- Permission refused: points to Privacy & Security → Screen & System Audio Recording, and offers to open it.
