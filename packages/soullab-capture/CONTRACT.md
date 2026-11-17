<!-- Copied from the J1 working notes on 2026-11-17. Part 1 is the J1 contract; part 2 is the reconciliation with the original handoff, whose amendments A1–A8 supersede the conflicting parts of part 1. -->

# Soullab Capture — J1 implementation contract

**Date:** 2026-11-17 · **Owner record:** SoullabTech/Sovereign#1979 (Sound Studio / LISTEN-01), preserved as the sole owner. Portfolio #1982 · audio authority #1984.
**Coordinator:** Claude Code (accountable engineering coordinator). JARVIS takes no part until its permissions and execution pathway are verified and separately authorized.
**Authority used:** founder J1 grant of 2026-11-17, for documentation and implementation-contract work only. Founder ruling of the same date: **Option A, a native Swift helper hosted by the existing MAIA Desktop.**
**State:** `PROPOSED` contract. No branch, source code, permission prompt, JARVIS dispatch, MAIA Desktop change, merge or deploy was made. Every source, security, media-rights, JARVIS and production hold stays in place.
**Evidence class:** code reads of canonical `clean-main-no-secrets` @ `ddf584b28f9aa0971a3fbb4eb948ed1f5bc9493c` (via `git show`). These establish what the code says, not runtime behaviour.

---

> **v0.2 note (2026-11-17, later the same day):** the original handoff was found in `~/Downloads` and reconciled. Disposition **REVISE**. **C1 is application/system-audio capture via Core Audio process taps, not microphone capture**, and the helper must not inherit MAIA's capture privilege. Amendments A1–A8 in `SOULLAB_CAPTURE_J1_RECONCILIATION_2026-11-17.md` **supersede** the conflicting parts of §§3–6 and 9 below. Those parts are kept for the record.

## 1. Reconciliation with the original handoff — **NOT POSSIBLE YET** (superseded: see the v0.2 note above)

Your message says the recovered handoff is attached, but **no document content or file reached this session**. I also searched files changed on this Mac in the last two days and found no match. So this contract is reconciled with the J0 findings only.

When the handoff arrives, I will check it against this contract on these points and record every difference as `HANDOFF / CONTRACT / RESOLUTION`:

1. File formats, sample rates, bit depths and channel counts.
2. Metadata, provenance and consent fields.
3. Storage location and the export path to Voice Alchemy, Elemental Resonance and the library.
4. Software monitoring: this contract excludes it.
5. System-audio capture: this contract excludes it.
6. Named milestones (J-numbers) and acceptance tests.
7. Any JARVIS role.
8. Any requirement that contradicts "no new application".

## 2. Correction to the J0 report (kept visible)

**J0 said:** the UI would be "a Capture desk in `/listen`".
**Superseded by evidence:** `maia-desktop/src/soullab-desktop-boundary.js` defines three realms:

- `maia` (privileged-local, preload `maia`)
- `jarvis` (privileged-local, preload `jarvis`)
- `platform` (remote, **no preload**)

`canExposeBridge('platform', …)` returns `false`. `/listen` is served in the `platform` realm, so **it can never call a native helper.** That is correct security, and this contract keeps it. The Capture UI must therefore be **local** (see §3.4). `/listen` can only *link to* or *describe* Capture.

## 3. Architecture

### 3.1 Process layout

```
MAIA Desktop.app (existing, hardened runtime, not sandboxed)
├─ Electron main process ── existing; gains capture-supervisor.js  [J4 only]
│    │  spawn() with stdio pipes; never a shell; fixed absolute path
│    ▼
│  soullab-capture-helper  (Swift executable, Contents/Resources/capture-helper/)
│    ├─ Core Audio AUHAL input unit (realtime thread)
│    ├─ SPSC ring buffer (lock-free)
│    ├─ writer thread → WAV/RF64 file on local disk
│    └─ meter thread → events over stdout (≤ 20 Hz)
└─ Local Capture window (privileged-local realm, narrow preload) [J4 only]
```

**Why a separate helper process, not a Node native addon:**
- Realtime audio and file I/O stay out of Electron's main process.
- A helper crash can't take MAIA down.
- No Node ABI coupling.
- The helper can be tested on its own with `swift test`.

**Audio never crosses IPC.** Only control messages, meter values and results do. Samples go straight from Core Audio to disk inside the helper.

### 3.2 Control protocol v1 (newline-delimited JSON over stdio)

| Direction | Message | Notes |
|---|---|---|
| main → helper | `hello` | The helper replies with `{protocol:1, version, build:"release"\|"debug"}`. Any other protocol version → main refuses. |
| main → helper | `listDevices` | Returns input devices: UID, name, transport, input channels, nominal and available rates. |
| main → helper | `authorizationStatus` | Status only. **Never prompts.** |
| main → helper | `requestAuthorization` | Sent only after an explicit member action ("Enable microphone for Capture"). |
| main → helper | `prepare {deviceUID, sampleRate, channels[], encoding:"s24"\|"f32", takeDir, takeName}` | `takeDir` must sit inside the storage root that main chose through a native folder dialog. The renderer never supplies a raw path. |
| main → helper | `start` / `stop` | Explicit only. There is no auto-start and no auto-resume. |
| helper → main | `state`, `meter`, `discontinuity`, `deviceLost`, `storageLow`, `finalized {path, sha256, frames, sampleRate, channels, encoding, recovered, dropouts}`, `error {code}` | Error codes form a closed enum. Errors never include file contents. |

Main validates every message against a schema and **kills the helper** on any unknown message, any message over 64 KiB, or protocol drift.

### 3.3 MAIA Desktop integration boundary (designed now, built only in J4)

| Item | Existing evidence | Proposed change (J4, needs Cabin Class A review #1898) |
|---|---|---|
| Packaging | `build.extraResources` already ships `cabin-runtime` and `vendor/jarvis-desktop/src` | Add `capture-helper/` (universal binary) the same way. |
| Signing | `hardenedRuntime: true`; `entitlementsInherit` uses the same plist | The helper inherits `device.audio-input` (already present). The inherited plist also carries `network.client`, `allow-jit`, `allow-unsigned-executable-memory` and `disable-library-validation`. **Proposal:** give the helper its **own** minimal plist (`device.audio-input` only) through per-binary signing. |
| TCC (macOS privacy permission) | `NSMicrophoneUsageDescription` = "MAIA uses your microphone only when you choose voice conversation." | The helper is a child process, so macOS attributes the microphone permission to **MAIA Desktop**. The usage string must honestly cover Capture. This is a founder-approved wording change. |
| Permission handler | `setPermissionRequestHandler` / `setPermissionCheckHandler` in `main.js` (lines 821–824) | Unchanged. The helper does not use web media permissions. |
| IPC | `ipcMain.handle('maia:…')` and a preload `maia` bridge with `contextIsolation`, `sandbox: true` | A new **`capture` realm** with its own preload `soullabCapture`. It exposes only `listDevices`, `status`, `requestAuthorization`, `chooseFolder`, `prepare`, `start`, `stop`, `onEvent` and `revealTake`. The `platform` realm stays bridge-less. |
| MAIA voice | `maia:voice-start` (renderer `getUserMedia`, `capture-worklet.js`) | Audio focus under #1984: while a take is recording, `voice-start` returns `CAPTURE_ACTIVE`. Capture does not stop MAIA voice mid-turn; it refuses to *start* while voice is active. Nothing auto-resumes. |
| Feature gate | — | `SOULLAB_CAPTURE_ENABLED` is off by default. Without the flag or the helper binary, the feature is entirely absent. |

### 3.4 Excluded from v1 (each needs its own later grant)

- **System-audio capture** (Core Audio process taps or ScreenCaptureKit) and its permission.
- **Software input monitoring.** The Scarlett 2i2 offers zero-latency direct monitoring in hardware; software monitoring adds feedback and latency risk.
- Any upload, sync, cloud backup, MAIA or AI analysis, transcription, or server persistence.
- Changing a device's nominal sample rate unless the member explicitly selects it, because the change affects other apps.
- iOS or Catalyst host (Option B). The core stays host-neutral so this can come later.

## 4. Recording engine specification

### 4.1 Input
- **Core Audio AUHAL** (`kAudioUnitSubType_HALOutput`) configured input-only, bound to the selected device by UID.
- Captured at the device's **native rate**. **There is no sample-rate conversion anywhere in the capture path.**
- Supported: 44.1, 48, 88.2, 96, 176.4 and 192 kHz; 1–8 channels (channel subset selectable). The Scarlett 2i2 is the reference device.
- Bluetooth/HFP inputs (AirPods Max at 24 kHz) are allowed but labelled **"low fidelity"** in device info.
- The realtime callback only renders into a preallocated buffer and pushes it to the ring buffer. It does no allocation, locking, logging, Objective-C/Swift ARC traffic, or I/O.

### 4.2 Buffering
- **SPSC lock-free ring buffer** of Float32 interleaved frames. Capacity is a power of two ≥ **4 s** at the chosen rate and channel count; at 192 kHz × 8 ch that is about 24 MiB.
- The writer thread drains every ≤ 50 ms and writes in chunks of ≥ 64 KiB.
- **Overrun:** the realtime side never blocks. It drops the newest block, increments `overrunFrames`, and the writer records a **discontinuity**.
- **Discontinuity detection** has three sources: ring overrun, gaps in AUHAL `mSampleTime`, and the device's `kAudioDeviceProcessorOverload` listener.
- Policy: **count and mark, never hide.** Each discontinuity becomes a `cue` point plus an entry in the take report. No silence is inserted and nothing is smoothed.

### 4.3 Encoding
- `s24`: 24-bit signed little-endian PCM. Float32 is converted by scaling ×8388607, rounding to nearest, and hard-clipping to the 24-bit range with a clip counter. **No dither** at 24-bit; this choice is recorded in metadata.
- `f32`: IEEE float 32-bit (`WAVE_FORMAT_IEEE_FLOAT`, with `fact` chunk). Bit-exact to the input and preserves over-0 dBFS peaks.
- More than 2 channels or `f32` → `WAVE_FORMAT_EXTENSIBLE` with an explicit channel mask.

### 4.4 File format and integrity
- **Container:**
  - BWF-compatible RIFF/WAVE with chunk order `bext`, `JUNK`(ds64-sized placeholder), `fmt `, `fact`(f32), `data`.
  - Promoted in place to **RF64** (EBU Tech 3306) when the data size crosses 4 GiB − header. For scale, 96 kHz/24-bit stereo reaches 4 GiB after about 2 h.
  - The `cue `/`LIST adtl` chunk and the take report are written after `data`.
- **`bext` fields:**
  - Originator "Soullab Capture" with version, origination date/time, and `TimeReference` (sample count since midnight).
  - CodingHistory, e.g. `A=PCM,F=96000,W=24,M=stereo,T=Scarlett 2i2 USB`.
- **Crash safety:**
  1. Write to `<take>.partial.wav` alongside `<take>.journal.json` (state `recording`, format, device, start time).
  2. Every **1 s**, flush data, rewrite the RIFF/`data` size fields to the bytes durably written, and `fsync` (`F_FULLFSYNC`).
  3. A power loss or crash loses at most about 1 s.
- **Finalize:**
  1. Drain the ring and write the cue/report chunks.
  2. Write final sizes, then `F_FULLFSYNC`.
  3. **Atomically `rename`** `.partial.wav` → `.wav` in the same directory, then `fsync` the directory.
  4. The journal records `finalized`.
- **Recovery** (at helper start, scanning only the storage root):
  1. For any `.partial.wav` with a journal, recompute sizes from the file length rounded down to whole frames.
  2. Repair the header, mark `recovered: true` in the `bext` description and the report, then finalize.
  3. **Never delete** an unreadable file; quarantine it as `.unrecoverable` and report it.
- **Hashing:** a streaming SHA-256 of the final file, recomputed by reading the file back after rename, and written to `<take>.provenance.json`.
- **Storage guard:**
  - Before `start`, require free space ≥ max(2 GiB, 10 minutes at the chosen format).
  - During recording, at < 1 GiB free emit `storageLow`; at < 256 MiB **stop and finalize** cleanly.
  - Note: the internal volume currently has 17 GiB free. The folder dialog suggests the member's Music folder, with an external volume allowed.
- **Path containment:** paths are resolved with symlinks resolved and must stay inside the chosen root. Names are sanitized (no `/`, no leading `.`, at most 128 bytes UTF-8). Existing files are never overwritten (`O_EXCL`).

### 4.5 Device and session events
- Device removed or not alive, a nominal rate change, or a default-device change during a take that affects the bound UID → **stop and finalize** with reason `deviceLost` or `formatChanged`. There is **no auto-resume**; a new take needs a new explicit `start`.
- Sleep: stop and finalize on `willSleep`. Wake does nothing automatically.
- MAIA Desktop quit, sign-out or account change → main sends `stop`, waits up to 5 s for `finalized`, then sends SIGTERM. A take that was cut off this way is recovered on the next launch.

### 4.6 Metering
- Per-channel sample peak, RMS (300 ms window) and a clip counter (any sample at or above full scale), computed on the writer side, never on the realtime thread.
- True-peak (4× oversampled) is computed on the meter thread at a reduced rate.
- Events are capped at 20 Hz. Meters are for display only and are never stored as analysis.

### 4.7 Provenance (Human Voice Source Library §8 ruling)
`<take>.provenance.json` holds:
- `schema: "soullab.capture.provenance.v1"`, `takeId` (UUIDv4), `sha256`, format, device, start/end times, discontinuities and recovery flag.
- **Member-entered** fields, all optional and never inferred: `performer`, `consentRef`, `rightsNote`, `location`, `notes`.

Capture itself grants no rights. Library admission still goes through the existing `soundStudioMediaGate`/`rightsPolicy` holds.

### 4.8 Permission handling
- `authorizationStatus` uses `AVCaptureDevice.authorizationStatus(for: .audio)`, which reads status without prompting.
- `requestAuthorization` uses `AVCaptureDevice.requestAccess(for: .audio)`. It is sent **only** after the member clicks one explicit control, and **at most once per app launch**.
- Denied or restricted → show guidance with a button that opens System Settings › Privacy › Microphone. There is no retry loop and no re-prompt.
- The AUHAL is never opened before status is `authorized`.
- **During J2 no code path that calls `requestAccess` is executed.** Tests inject a `MicrophoneAuthorization` fake (§5.3), and the real implementation is excluded from the test target.

## 5. Proposed file manifest — `packages/soullab-capture/` (to be written in J2)

```
packages/soullab-capture/
├─ Package.swift                         swift-tools 6.0; macOS 13+; products: SoullabCaptureCore (lib), soullab-capture-helper (exe)
├─ README.md                             purpose, boundaries, holds, how to test
├─ CONTRACT.md                           this contract (copied in, then versioned)
├─ PROTOCOL.md                           control protocol v1 + JSON schemas
├─ Sources/SoullabCaptureCore/
│  ├─ Model/CaptureFormat.swift          rates, channels, encoding, validation
│  ├─ Model/CaptureState.swift           idle→prepared→recording→finalizing→finalized|failed state machine
│  ├─ Model/CaptureError.swift           closed error-code enum
│  ├─ Device/DeviceCatalog.swift         protocol
│  ├─ Device/CoreAudioDeviceCatalog.swift  HAL enumeration, transport, rates; liveness/rate listeners
│  ├─ Engine/AudioSource.swift           protocol (start/stop, frame callback, timestamps)
│  ├─ Engine/HALInputSource.swift        AUHAL input-only implementation
│  ├─ Engine/RingBuffer.swift            SPSC lock-free Float32 ring
│  ├─ Engine/DiscontinuityDetector.swift sampleTime gaps, overruns, overload
│  ├─ Engine/CaptureSession.swift        orchestration, policy enforcement, stop-and-finalize paths
│  ├─ File/WAVLayout.swift               RIFF/BWF/RF64/ds64/fact/cue chunk builders + parser
│  ├─ File/SampleEncoder.swift           f32→s24 (round, clip count), f32 passthrough
│  ├─ File/TakeWriter.swift              partial file, 1 s durable size updates, F_FULLFSYNC, atomic finalize
│  ├─ File/TakeJournal.swift             journal sidecar
│  ├─ File/TakeRecovery.swift            scan, repair, quarantine
│  ├─ File/StreamingHash.swift           CryptoKit SHA-256
│  ├─ File/StorageGuard.swift            free space, containment, name sanitizing, O_EXCL
│  ├─ Meter/LevelMeter.swift             peak/RMS/clip; TruePeak.swift (4× oversampling)
│  ├─ Provenance/ProvenanceRecord.swift  v1 schema encode/validate
│  ├─ Policy/CapturePolicy.swift         explicit-start, no-auto-resume, no-network invariants
│  └─ Permission/MicrophoneAuthorization.swift  protocol + AVCaptureDevice implementation
├─ Sources/soullab-capture-helper/
│  ├─ main.swift                         stdio loop, signal handling (SIGTERM → finalize)
│  ├─ ControlProtocol.swift              Codable messages, size limit, version check
│  └─ HelperServer.swift                 routes messages to CaptureSession; recovery at start
├─ Sources/SoullabCaptureTestSupport/    (test-only target; never linked into the helper)
│  ├─ SyntheticSource.swift              deterministic sine/impulse/LSB-toggle/full-scale/seeded noise; injectable gaps & overruns
│  ├─ FakeDeviceCatalog.swift            scripted add/remove/rate-change
│  └─ FakeAuthorization.swift            authorized/denied/notDetermined; counts requests
├─ Tests/SoullabCaptureCoreTests/        (listed in §6)
├─ Tests/SoullabCaptureHelperTests/      protocol, crash-recovery subprocess, linkage scan
├─ Tests/Fixtures/                       golden header bytes, MANIFEST_SHA256.txt
└─ js/
   ├─ captureClient.mjs                  Node client for the protocol (later imported by maia-desktop in J4)
   └─ captureClient.test.mjs             schema validation, kill-on-drift, timeout behaviour (against debug helper in synthetic mode)
```

The debug-only `--synthetic` helper mode is compiled under `#if DEBUG`. **A release build cannot fake input.**
Files **not** touched in J2: anything under `maia-desktop/`, `app/`, `lib/`, `components/`, `ios/`, root `package.json`, and CI.

## 6. Test requirements and fixtures

**J2 offline suite** (no microphone, no TCC, no network). Run with `swift test` and `node --test js/` on the founder Mac Studio:

| # | Test | Pass criterion |
|---|---|---|
| T1 | Format matrix: every rate × {1, 2, 8 ch} × {s24, f32} from SyntheticSource | Read back through an independent parser **and** `AVAudioFile`; frame count exact |
| T2 | Bit-exactness | f32 round-trip identical; s24 error ≤ 0.5 LSB; full-scale clip counted |
| T3 | Header golden bytes | Matches committed fixtures; `afinfo` parses every fixture |
| T4 | RF64 promotion | Crossing 4 GiB is simulated with a sparse file and a size-injection hook; ds64 is correct |
| T5 | Crash recovery | The helper subprocess is `SIGKILL`ed at random points ×50; every recovered file is valid and loses ≤ 1 s + 1 chunk; none are deleted |
| T6 | Unrecoverable input | Truncated or garbage partial file is quarantined, reported, and never deleted |
| T7 | Ring overrun | Injected writer stall → `overrunFrames` > 0, cue point written, report entry made, no crash |
| T8 | Timestamp gap | Injected `mSampleTime` jump → discontinuity marked |
| T9 | Device loss / rate change | FakeDeviceCatalog removal mid-take → finalized with `deviceLost`, no restart |
| T10 | Storage guard | Low-space injection → refuses start / emits `storageLow` / stops and finalizes |
| T11 | Path containment | Symlink escape, `..`, overlong and dot-prefixed names, and existing files are all refused |
| T12 | Policy | No start without explicit `start`; no auto-resume after any stop reason; one `requestAuthorization` per launch; AUHAL never opened unless authorized (fake) |
| T13 | Provenance | SHA-256 in JSON equals a fresh hash of the file; schema validates; no inferred fields |
| T14 | Protocol | Unknown message, oversize, or bad version → main-side client kills the helper; closed error enum |
| T15 | No network | `otool -L` on the release helper shows no Network/CFNetwork linkage beyond the system minimum, and a symbol scan finds no `URLSession`/`NWConnection`/`socket`/`connect` |
| T16 | Realtime hygiene | Debug-build instrumentation asserts zero allocations/locks inside the render callback during T1 |
| T17 | Concurrency | Swift 6 strict concurrency compiles with zero warnings |

**Device suite (J3, needs a separate microphone grant):**
- Scarlett 2i2 at 48/24 and 96/24, with a 60-minute take showing **0 discontinuities**.
- Clock-drift report.
- Unplug mid-take → clean finalize.
- Sleep/wake.
- AirPods Max shown as low fidelity.
- External volume target.
- The founder listens to takes on headphones. "It feels glitchy" counts as a failure signal.

**Integration suite (J4):** packaged signing verification (`codesign --verify --deep --strict`, per-binary entitlements), a TCC prompt-text review, refusal of MAIA voice during capture, the platform realm still bridge-less, and the feature absent when the flag is off.

## 7. Rollback plan

| Stage | Rollback | Member data |
|---|---|---|
| J2 (package only, review branch) | Delete the review branch/worktree; nothing else references it | None exists |
| J3 (device witness) | Remove the debug build; revoke the microphone permission in System Settings if desired | Test takes stay in the chosen folder and are **never auto-deleted** |
| J4 (MAIA Desktop integration) | Set `SOULLAB_CAPTURE_ENABLED` off **or** ship without `capture-helper/`; the realm is not registered when the flag is off; one revert commit | Takes on disk are the member's files; uninstalling or rolling back never deletes them |

There are no database migrations, server persistence or remote state in any stage.

## 8. Milestones and authority

| Stage | Scope | Authority state |
|---|---|---|
| J0 | Read-only census | Done |
| J1 | This contract | Done, pending handoff reconciliation |
| **J2** | Write `packages/soullab-capture/` + offline tests on one review branch | `RULING_REQUIRED` — request below |
| J3 | Microphone permission + Scarlett device witness | `HELD` |
| J4 | MAIA Desktop integration, capture realm, entitlements, usage string; needs Cabin Class A review #1898 | `HELD` |
| J5 | Export to Voice Alchemy / Elemental Resonance; library admission via rights gate | `HELD` |
| Release | Founder GO | `HELD` |

## 9a. Revised J2 authorization request (v0.2, supersedes §9)

> I authorize **J2 (C1 core, offline)** for Soullab Capture under owner #1979, Desktop owner #1892 informed:
>
> 1. Re-verify `clean-main-no-secrets`. Create **one** review-only worktree and branch `review/soullab-capture-core-20261117` from that verified SHA, outside `/Users/soullab/MAIA-SOVEREIGN`'s working tree.
> 2. Write **only** files under `packages/soullab-capture/`: the §5 manifest as amended by reconciliation §3 (process-tap C1, s24 WAV, helper bundle data files).
> 3. Build and run offline tests T1–T20 (as amended), using only the installed Xcode 26.3 / Swift 6.2.4 and Node, Apple system frameworks, and **no installs or third-party dependencies**.
> 4. Commit on that branch, push it for review, and post one evidence handoff to #1979 with SHA, test results and deviations, plus one short notice to #1892.
>
> **Not authorized:**
> - Calling `AudioHardwareCreateProcessTap` or any real tap/aggregate creation.
> - Microphone or system-audio permission prompts.
> - Launching the helper app bundle via LaunchServices.
> - Signing, notarizing or installing anything.
> - Any change to `maia-desktop/` or any other path.
> - JARVIS dispatch, PR merge, deployment, or lifting any hold.
>
> **Stop condition:** stop and report if custody is ambiguous or if a test needs an excluded path or a real tap.

You can strike clause 4 (push and posts). J2 then ends with a local commit and a handoff file.

## 9. J2 authorization request (exact) — SUPERSEDED by §9a

> I authorize **J2** for Soullab Capture under owner #1979:
>
> 1. Re-verify `clean-main-no-secrets` and create **one** review-only worktree and branch `review/soullab-capture-core-20261117`, based on that verified SHA, outside `/Users/soullab/MAIA-SOVEREIGN`'s working tree.
> 2. Write **only** files under `packages/soullab-capture/`, as listed in §5 of the J1 contract.
> 3. Build and run the J2 offline suite (T1–T17) locally with the installed Xcode 26.3 / Swift 6.2.4 and Node, with **no new software installs** and no package dependencies beyond the Swift standard library and Apple system frameworks.
> 4. Commit to that review branch and **push it to GitHub for review**, then post one evidence handoff to #1979 (SHA, test results, deviations).
>
> **Not authorized:** microphone or system-audio permission requests or prompts; running the real `HALInputSource` against hardware; any change to `maia-desktop/` or any other path; JARVIS dispatch; PR merge; deployment; lifting any hold.
> **Stop condition:** stop and report if canonical custody is ambiguous, if a test can only pass by touching an excluded path, or if the handoff document contradicts this contract.

Push and the #1979 post are clauses you can strike out. If you strike them, J2 ends with a local commit and a handoff file only.

---

# Soullab Capture — J1 reconciliation with the original handoff

**Date:** 2026-11-17 · **Owner:** #1979 (LISTEN-01), unchanged · **State:** `PROPOSED`. Documentation only.
**Handoff read:** `~/Downloads/Soullab_Capture_JARVIS_ClaudeCode_Handoff_2026-11-17.md`, 12,180 bytes, SHA-256 `2ccc42ed606fe40a9fcbba43941be955a1aa141416499fab3ef1ed4e314222fd`. Read as a planning input, not a grant (handoff §6).
**Prior record found:** DN17 native microphone capture lease, Desktop owner #1892, `/Volumes/MAIA Recovery/…/DN17_NATIVE_MIC_CAPTURE_LEASE_CLASS_A_HANDOFF_20261021.md` (Class A source PASS candidate; physical Mac and release HOLD).

## Disposition: **REVISE**

- **Source seam found:**
  - MAIA Desktop already ships bundled runtimes via `build.extraResources`.
  - Its main process already supervises child processes.
  - Its realm boundary allows a local, narrow bridge.
- **Two reasons it is not `SOURCE_SEAM_FOUND` yet:**
  1. The contract recorded the **wrong first source**.
  2. The handoff forbids a capture helper from **inheriting MAIA's microphone/capture privilege**. On this Mac, a helper that does not inherit that privilege has not been proven possible without private APIs.

## 1. Differences: HANDOFF / CONTRACT / RESOLUTION

| # | Handoff | J1 contract v0.1 | Resolution |
|---|---|---|---|
| D1 | **C1 = one selected application's output**, via Core Audio **process taps**. Microphone/interface capture is **C2**. | C1 = microphone/interface (Scarlett) via AUHAL. System audio excluded. | **Handoff governs.** C1 becomes a process-tap source. Microphone/AUHAL moves to C2. The engine below the source (ring buffer, writer, WAV, recovery, meters, provenance) is unchanged. |
| D2 | `NSAudioCaptureUsageDescription`; macOS 14.2+; **no capture privilege inherited from MAIA or JARVIS**. | Child helper inheriting MAIA Desktop's microphone TCC identity and entitlements. | **Contract revised (A3).** The helper becomes its own signed nested bundle and is launched so that it is its own responsible process. Whether macOS actually attributes the permission to it is `UNKNOWN` until J3. If it does not, **HOLD**; no private "disclaim" API. |
| D3 | 24-bit PCM WAV stereo. Record actual source and output rates. 32-bit float/96 kHz "later". | s24 **and** f32, 1–8 channels. | C1 is **s24 only**, mono or stereo as the tap gives. f32 is deferred. |
| D4 | CAF / split-file / **RF64 later**. | RF64 promotion in C1. | **RF64 deferred.** C1 stops and finalizes cleanly before 4 GiB (about 4.1 h at 48 kHz/24-bit stereo; about 2 h at 96 kHz). |
| D5 | Explicit source picker, timer, peak/RMS meter, Start/Stop, save folder, truthful states. | Device picker, meters. | The picker lists running processes that own audio objects, by name and bundle ID. |
| D6 | Fail closed when the app exits; clean up taps and aggregate devices; handle device switch. | Device-loss handling only. | Added (A5): source exit → finalize with `sourceExited`. Every stop path destroys the IOProc, aggregate and tap. At helper start, orphaned Soullab aggregates and taps are found and removed. |
| D7 | No DRM circumvention; don't make commercial streaming a source. | Not addressed. | Added (A7): a protected source that taps as silence is recorded as captured. No workaround. Takes carry no rights claim. |
| D8 | Never call a path bit-perfect without end-to-end qualification. | "No SRC anywhere in the capture path". | Narrowed: no SRC **inside Soullab Capture**. Conversion between the source app and the tap is invisible to us and is reported as `upstreamConversion: unknown`. |
| D9 | Owners: Desktop **#1892**; JARVIS **#1974/#1843**. | Only #1979/#1982/#1984 named; Cabin #1898 for integration. | Added. #1892 (open, last activity 2026-10-30) must dispose the Desktop integration. #1843 R7 **HOLD** and #1974 **HOLD** confirmed open, so JARVIS is excluded and the Claude Code path is used without routing around the refusal. |
| D10 | J2 = C1 implementation in an isolated worktree or bounded native module; an **isolated harness** only after a separate exact grant; J3 = physical acceptance with 1-min and 30-min masters; J4 = Sound Studio admission. | J2 = package; J3 = device; J4 = Desktop integration; J5 = export. | Aligned to the handoff's J2/J3/J4. Desktop integration and export move inside handoff J4 as sub-gates J4a (Desktop, #1892 + Cabin #1898) and J4b (Sound Studio / Voice Alchemy admission). The J3 harness is named as needing its own grant. |
| D11 | Output names `CAPTURE_J0_OWNER_INTAKE.md`, `CAPTURE_J1_IMPLEMENTATION_CONTRACT.md` + acceptance matrix. | Different file names. | These files will be renamed when filed to #1979. The content maps one to one. |
| D12 | Check Xcode/macOS and disk before any compile. | Done in J0. | Confirmed: macOS 15.8.2 (≥ 14.2). Xcode 26.3, SDK 26.2 has `AudioHardwareTapping.h` and `CATapDescription.h` (`AudioHardwareCreateProcessTap` `API_AVAILABLE(macos(14.2))`). 17 GiB internal free is enough for 30-minute 48 kHz/24-bit masters (about 0.5 GB each). |
| D13 | — | Permission status "without prompting". | **SDK 26.2 headers show no public API to read or request system-audio permission.** The prompt comes from tap creation itself. So in C1 a tap is created only on an explicit Start, and status is learned from that result. |
| — | Consistent | Local-only, no DSP/normalization, no auto-start, no upload/AI, crash safety, SHA-256, `1×` explicit Start, no auto-resume | Kept. |

## 2. Contract amendments (apply to J1 contract v0.1 → v0.2)

**A1 — C1 source.** Add `Engine/ProcessTapSource.swift`:
1. Translate the chosen PID to an audio process object (`kAudioHardwarePropertyTranslatePIDToProcessObject`).
2. Build a `CATapDescription` stereo or mono mixdown of that one process, with `isPrivate = true` and `muteBehavior = CATapUnmuted` so the user still hears it.
3. Create it with `AudioHardwareCreateProcessTap`.
4. Create a **private** aggregate device that holds only that tap (`kAudioAggregateDeviceTapListKey`).
5. Attach an IOProc block that feeds the existing ring buffer.
6. Read the tap format (`kAudioTapPropertyFormat`) and record it.

`HALInputSource` and microphone `DeviceCatalog` leave the J2 manifest (C2).

**A2 — Permission.**
- `NSAudioCaptureUsageDescription` lives in the helper's own Info.plist, with founder-approved wording.
- No `requestAccess` and no microphone entitlement in C1.
- Denial or revocation produces an obvious error, zero samples, and no leftover tap or aggregate.
- **J2 never calls `AudioHardwareCreateProcessTap`.** It sits behind a `TapProvider` protocol; tests use `FakeTapProvider`.

**A3 — No privilege inheritance.**
- The helper is `Soullab Capture Helper.app`, nested inside MAIA Desktop (`Contents/Helpers/`):
  - `LSUIElement` (no Dock icon) and bundle ID `life.soullab.maia.desktop.capture`.
  - Hardened runtime with **its own minimal entitlements**: none of `network.client`, `allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation` or `device.audio-input`.
  - It is not distributable on its own.
- **Launch:** MAIA Desktop's main process launches it via LaunchServices, so it is its own responsible process for TCC, instead of `spawn`.
- **Control channel** (replaces stdio):
  - A Unix-domain socket in a per-launch `0700` directory, with a one-time token in a `0600` file.
  - The protocol v1 messages are unchanged.
- **Proof needed (J3):** System Settings › Privacy › Screen & System Audio Recording names the helper, not MAIA Desktop, and MAIA Desktop's own permissions do not change.

**A4 — Format.**
- s24 WAV (`WAVE_FORMAT_PCM`, or `EXTENSIBLE` with a channel mask when stereo).
- `bext` + `fmt ` + `data`; the cue/report chunk follows `data`.
- Rate = the tap's reported rate.
- Stop and finalize at 4 GiB − 64 KiB.

**A5 — Lifecycle.**
- Stop and finalize, with the reason recorded, on any of these:
  - The source process exits (`kAudioProcessPropertyIsRunning`, process-list listener).
  - The default output device changes or is lost.
  - The tap format changes.
  - Sleep.
  - The helper receives SIGTERM.
- Cleanup order: stop the IOProc, destroy the IOProc, destroy the aggregate, destroy the tap.
- At start, sweep for aggregates and taps whose UID begins `life.soullab.capture.` and destroy them.

**A6 — Picker.** List `kAudioHardwarePropertyProcessObjectList` entries with PID, bundle ID, name and "is producing output". Soullab Capture itself is excluded. System-wide capture is not offered in C1.

**A7 — Rights.**
- Takes carry `rightsAttestation: "member-asserted"` (an optional member note) and never a Soullab rights claim.
- No catalog or library admission.

**A8 — Supervisor race discipline (from DN17).**
- Every Start, permission result and stop acknowledgement carries a monotonic capture generation.
- A late result for an old generation is discarded and its tap is destroyed.
- A second Start while one is pending is refused.

## 3. Revised J2 manifest delta (`packages/soullab-capture/`)

**Removed for C1:**
- `Device/CoreAudioDeviceCatalog.swift`, `Engine/HALInputSource.swift`
- `Permission/MicrophoneAuthorization.swift`, `FakeAuthorization.swift`
- RF64 code in `WAVLayout.swift`

**Added:**
- `Engine/TapProvider.swift` (protocol)
- `Engine/ProcessTapSource.swift` (real; compiled but **never executed in J2**)
- `Engine/TapCleanup.swift` (orphan sweep)
- `Source/ProcessCatalog.swift` (protocol + Core Audio implementation; read-only property queries)
- `Sources/SoullabCaptureTestSupport/FakeTapProvider.swift` and `FakeProcessCatalog.swift`
- `HelperBundle/Info.plist`, `HelperBundle/Helper.entitlements` (data files; not wired into MAIA Desktop)
- `Sources/soullab-capture-helper/SocketServer.swift`

## 4. Revised J2 offline tests

**Unchanged:** T2 (s24 only), T3, T5, T6, T7, T8, T10, T11, T13, T14, T15, T16, T17.

**Changed:**
- **T1** — rates 44.1–192 kHz × {mono, stereo}, s24.
- **T4** — 4 GiB cap: stop and finalize, using a size-injection hook.
- **T9** — the fake source process exits / the fake output device changes → `sourceExited` / `deviceChanged`, no restart.
- **T12** — tap created only on explicit Start (fake); fake denial → zero samples and nothing left behind; no auto-resume.

**New:**
- **T18** — cleanup: every stop path destroys IOProc → aggregate → tap in order, on the fake provider; the orphan sweep removes only `life.soullab.capture.*`.
- **T19** — generation discipline: a late fake permission result or start acknowledgement for an old generation is discarded and cleaned up.
- **T20** — helper entitlements file contains none of the forbidden keys; the Info.plist has `NSAudioCaptureUsageDescription` and `LSUIElement`.

## 5. J3 physical acceptance (needs a separate grant; from handoff §5)

- The founder personally allows system-audio recording for the helper, and the TCC attribution is witnessed.
- 1 kHz tone and silence from a rights-cleared synthetic source app: correct channel order, rate, bit depth, data length, level and stereo separation.
- App A only; app B and system alerts are absent.
- Fail closed on app exit, output device switch, deny and revoke.
- No ghost devices left in Audio MIDI Setup.
- 1-minute and 30-minute masters with SHA-256, peak/true-peak and dropout counter.
- The founder listens on headphones.
- The macOS version and the consent results are recorded, not asserted.
