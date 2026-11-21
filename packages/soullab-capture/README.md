# Soullab Capture — capture core (C1)

Local-first, high-fidelity capture for Soullab Sound Studio.
**Owner record:** SoullabTech/Sovereign#1979 (Sound Studio / LISTEN-01). Desktop owner #1892. Audio authority #1984. Portfolio #1982.

**State:** review branch `feature/soullab-capture-core-20261117` only. Not merged, not deployed, not signed for distribution, not installed. Every source, security, media-rights, JARVIS and production hold stays in place, including Cabin Class A #1898.

| Stage | Where it stands | Record (#1979 unless noted) |
|---|---|---|
| J2 — C1 core, offline | Built; offline suite | comment 6952074500 |
| J3 — founder-Mac physical acceptance | Run complete, 2026-11-17 | comment 6962762911 |
| J4a-1 — MAIA Desktop hosts the helper (`maia-desktop/src/soullab-capture-host.js`) | Built; merge held for #1898 | comment 6963522658; #1892 notice |
| J4a-2 — the Capture window (`maia-desktop/src/capture*.js`, `capture.html`) | Built; founder-witnessed in a dev launch; merge held for #1898 | comment 6964394135 |
| J4b-1 — Transform reads a take's origin (`lib/listening/transform/captureTake.ts`) | Built (`2f7d61828`) | comment 7063339808 |
| J4b-2 — the Drone desk reads a take's origin; optional check against the take's `.provenance.json` | Built in the working tree; not committed | to be posted |

This table is a status summary. The records above, and the code, are the evidence.

## What C1 does

C1 records **one selected application's audio output** to a lossless local WAV, using Core Audio process taps (macOS 14.2+).

- **Format:** 24-bit PCM WAV with a BWF `bext` chunk, at the rate the tap delivers.
- **No processing:** no resampling, DSP, normalization or dither inside Soullab Capture. Any conversion upstream of the tap is reported as `upstreamConversion: "unknown"`.
- **Explicit control:** capture starts only on an explicit `start`. Every stop finalizes the take. Nothing auto-resumes.
- **Crash safety:** the file is valid on disk every second. A crash loses at most about one second. Recovery repairs cut-off takes at the next launch and never deletes audio.
- **Gaps are marked, not hidden:** each one becomes a cue point and a provenance entry.
- **Provenance:** every take gets `<take>.provenance.json` with its SHA-256 (read back from disk), format, source, gaps, and optional member-entered fields (never inferred). Soullab makes no rights claim about a capture.
- **Local only:** no network, upload, analysis, transcription or MAIA access. The helper serves one local Unix socket and never connects anywhere.

Microphone and interface capture (Scarlett, AUHAL) is **C2**. RF64 and 32-bit float are deferred.

## Layout

| Path | What |
|---|---|
| `Sources/SoullabCaptureCore` | Engine: lock-free ring, realtime sink, WAV/BWF layout, crash-safe writer, recovery, meters, provenance, session state machine, process-tap source |
| `Sources/SoullabCaptureCore/Engine/CoreAudioTapProvider.swift` | The real Core Audio calls. Not executed by the offline suite; first run on hardware in J3 |
| `Sources/soullab-capture-helper` | Helper executable: local socket server, control protocol v1 |
| `Sources/SoullabCaptureTestSupport` | Test-only fakes. Never linked into the helper |
| `HelperBundle/` | Proposed Info.plist and an empty entitlements file for the nested helper app (J4) |
| `js/captureClient.mjs` | Host-side protocol client for MAIA Desktop's main process (J4) |
| `PROTOCOL.md` | Control protocol v1 |
| `CONTRACT.md` | J1 implementation contract and the reconciliation with the original handoff |

## Verify

```bash
./Scripts/verify.sh
```

The script uses no microphone, no system-audio permission, no network and no installs. It runs:
- strict Swift 6 builds with warnings as errors (T17);
- release-helper linkage and symbol checks (T15);
- `swift test` (T1–T20);
- the Node client contract tests.

## Not done (each needs its own grant)

- **C2:** microphone and interface capture (Scarlett, AUHAL). Designed in `CONTRACT.md` (J1 §4.1, §4.8, §5) and moved to C2 by reconciliation D1. No source yet. It would add an `AudioSource` below the unchanged engine.
- **C3:** virtual-device routing. Privileged (HAL driver); held for Class A review. No design record in this package.
- **J4b, remaining:** Voice Alchemy, and library admission through the existing rights gate.
- **Release:** merge, signing for distribution and deployment are held (#1898).
