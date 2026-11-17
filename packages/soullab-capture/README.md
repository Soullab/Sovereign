# Soullab Capture — capture core (J2, review only)

Local-first, high-fidelity capture for Soullab Sound Studio.
**Owner record:** SoullabTech/Sovereign#1979 (Sound Studio / LISTEN-01). Desktop owner #1892. Audio authority #1984. Portfolio #1982.

**State:** review branch only. Not merged, not wired into MAIA Desktop, not signed, not installed. Every source, security, media-rights, JARVIS and production hold stays in place.

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
| `Sources/SoullabCaptureCore/Engine/CoreAudioTapProvider.swift` | The real Core Audio calls. **Compiled, never executed in J2** |
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

## Not done here (each needs its own grant)

- **J3:** the founder Mac physical acceptance. This is the first real tap, the system-audio permission, and proof that macOS attributes the permission to the helper rather than MAIA Desktop.
- **J4a:** MAIA Desktop integration (#1892, Cabin Class A #1898): the nested helper bundle, LaunchServices launch, a local Capture window, and founder-approved permission wording.
- **J4b:** Sound Studio, Voice Alchemy and library admission through the existing rights gate.
