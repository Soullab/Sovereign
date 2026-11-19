# VOICE-2026 — SOURCE LEVEL-CALIBRATION-02 — Design — 2026-11-19

**Status:** DESIGN ADJUDICATED — founder act, 2026-11-19: accepted, with rulings
R1–R5 ruled as recommended (§6). Records-only. This record authorizes no device
execution, playback, install, launch, sample, threshold change, or acceptance. The
pins it accompanies are drafts until a separate founder device authority.
**Parent:** Lane K · K0 (`VOICE_FULL_CLOSURE_RUNBOOK_2026-09-21.md`).
**Supersedes for execution, without rewriting:** `SOURCE_LEVEL-CALIBRATION-01`
Act-01 and its Retry-01 pin.
**Inherits unchanged:** `SOURCE_LEVEL-CALIBRATION-01_DESIGN_2026-09-21.md` §2–§7.

```text
Class: A
Governing authority: VOICE-2026 ARCH-01 (ratified 2026-09-11); Runbook Lane K, K0;
                     founder direction 2026-11-19 to continue the ratified work
Current gate: K0 — source visibility calibration (records and pins; no device act)
Evidence subject: SID organism faf918b5c (VPIO-02); calibration implementation 2f211f432
Stop boundary: no source change and no device act; each later step needs its own
               founder authorization
```

## 1. Why a new act

`SOURCE_LEVEL-CALIBRATION-01` Act-01 stopped on 2026-09-21 at level L1, sample 1 of
5, before any playback, on a shell fault (`idx: unbound variable`). It produced zero
measurements. Retry-01 was pinned the same day and never run.

Read on 2026-11-19 (JARVIS Work Unit
`voice-2026-ios-recovery-k0-precondition-read-20261119`, session `s-2f85d7d7`,
read-only):

- The Act-01 marker, its run root, the preflight pointer and the preflight worktree
  all lived under `/private/tmp`. All are absent. No git worktree for them is
  registered.
- Act-01 has no record document. It is attested only by the Retry-01 pin's own
  assertions and by `__tests__/voice-source-calibration-pins.test.ts`.
- The Retry-01 pin's first checks require that lost evidence and have no path that
  proceeds without it.

So Retry-01 cannot run as pinned, and a retry "on the basis of Act-01" can no longer
be evidenced. This is a custody loss, not a measurement result. Nothing about the
source, the organism or the reader law is called into question by it.

## 2. Disposition of the earlier act

- **Act-01:** `RETURNED · ZERO MEASUREMENT · EVIDENCE ROOT LOST (2026-11-19 read)`.
  It stays in the record as it is. Nothing is reconstructed from memory.
- **Retry-01 pin:** `RETIRED UNRUN`. The file stays; it is not edited or deleted.
- **SOURCE-03's ten rows:** unchanged, `UNMEASURED` forever, as the 01 design ruled.

## 3. The question (unchanged)

> What prospectively pinned source level, at a recorded fixed geometry, makes the
> existing gated 997 Hz source visible at the consumed seam with enough margin that
> a fresh source-discrimination population is valid under the unchanged reader law?

## 4. Frozen, inherited from the 01 design without change

- V1 visibility threshold `B997 >= 10 × C_base` (20 dB).
- The ordered 2 Hz source-signature law and its threshold.
- Source taxonomy, reader semantics, K00-06 law, SID organism semantics.
- The fixture: 48 kHz mono PCM16, 997 Hz, 250 ms on / 250 ms off, peak 0.70 FS,
  validated by header, frame, duty, crossing and SHA before use.
- The closed ladder: L1 gain 0.285714 (0.20 FS), L2 0.571429 (0.40 FS),
  L3 1.000000 (0.70 FS). Host gain never above 1.0. **No L4.**
- Phase A: VP ON, Mode L, N=5 per level, no 440 Hz render, no row replacement, no
  top-up. A level passes only if all five rows have valid V1, valid ordered 2 Hz
  signature, and at least 26 dB separation. The first passing level is the pin.
  If L3 fails the result is `NO LEVEL PIN`.
- Phase B: VP OFF, N=3 at the selected level and geometry, characterization only.
- Output: Mac Studio Speakers (built-in), system volume 69, not muted.
- Safety: no headphones, no ear near the speaker, immediate stop on distortion,
  clipping evidence or discomfort; no louder level under the same act after a stop.
- The falsifier: **return, never adapt.**

## 5. What changes, and only this

| # | Change | Reason |
|---|---|---|
| C1 | New act identity `SOURCE-LEVEL-CALIBRATION-02`; new preflight pin and run pin files; new marker names | The 01 identifiers are bound to a lost evidence root |
| C2 | The preflight worktree, pointer, marker and run root live under a **durable** root, not `/private/tmp` | `/private/tmp` is cleared by the system; that is how custody was lost |
| C3 | After the act, the sealed run root and its populations are copied into `docs/programme/VOICE-2026/driver-ledger/` on the record-of-record branch by a separate, founder-reviewed records commit. The pin itself does not commit | A sealed population should not exist in only one place |
| C4 | Geometry is declared fresh. No `UNCHANGED` confirmation exists in this act | Two months have passed; continuity with September cannot be attested |
| C5 | The run pin has no dependency on any prior act | There is no prior act to depend on |
| C6 | Preflight records the Xcode and SDK versions it ran under | The toolchain moved from the iPhoneOS 26.2 SDK (September preflight) to Xcode 26.3 |

Nothing else changes. In particular the batch script, fixture generator, reader,
thresholds, ladder and the SID organism are untouched.

## 6. Rulings (founder, 2026-11-19: each ruled as recommended)

**R1 — Durable evidence root.** Where C2's root lives.
*Recommend:* `~/voice-2026-witness/` on the internal disk, one subfolder per act,
never under `/tmp`, `/private/tmp` or a removable volume.

**R2 — Is the organism still on the phone, and is it the same build?** The preflight
requires the installed SID bundle to match its pinned identity
(`apps-vpio02sid.json`). After two months that app may be gone, expired, or
replaced. If it must be reinstalled, it would be rebuilt under Xcode 26.3, which is
a new binary of the same source. The source gates state that "the app under test is
never rebuilt for the driver".
*Recommend:* a read-only device check first (list the installed bundle and its
identity; no install, no launch). If the pinned build is present, proceed. If not,
stop and open a `MAC-COMPILE` identity act for the rebuild before calibration,
rather than treating a rebuilt binary as the September subject.

**R3 — Same iPhone?** The September subject device identity is in the record; the
phone connected today is an iPhone 16 Pro Max.
*Recommend:* the preflight compares device identity to the record and refuses on
mismatch. A different phone is a different subject and needs its own ruling.

**R4 — Authority values for the new act.** They must be new and set only by the
founder. Proposed names, for the founder to accept or replace:
`K00_EXEC_AUTHORITY=FOUNDER-AUTHORIZED-SOURCE-LEVEL-CALIBRATION-02`,
`K00_CAL_OPERATOR_SAFETY=CONFIRMED`, plus the five geometry declarations
(`K00_CAL_PHONE_ORIENTATION`, `_PHONE_MIC_EDGE`, `_DISTANCE_CM`, `_SUPPORT`,
`_ROOM_STATE`). `K00_CAL_RETRY_BASIS` and `K00_CAL_GEOMETRY_CONFIRMATION` are
dropped (C4, C5).

**R5 — Implementation commit.** Whether the 02 pins bind to implementation
`2f211f432` unchanged (which already carries the repaired preplay stop), with the
new pins added as records only.
*Recommend:* yes. If writing the pins shows any batch-script change is needed for
C2, stop and return it as a finding rather than widening the act.

### 6.1 Findings made while writing the pins (2026-11-19)

- **Falsifier §10.1 did not fire.** `k00-source-calibration-batch.sh` at the pinned
  implementation derives every path from its own location and names no temporary
  directory. C2 needs no change to it.
- **Naming artifact.** The frozen batch names its population folders
  `SOURCE-LEVEL-CALIBRATION-01-<level>-<vp>-<stamp>`. Under R5 that stays. The 02
  act's identity is carried by its run root, marker and `populations.tsv`.
- **R3, read from the record:** the 01 preflight pins the device as
  `A0736AC8-793B-516F-AC72-C076DB6CEE38`. The iPhone connected to this Mac on
  2026-11-19 reports the same identifier. The 02 preflight keeps that pin.
- **R2:** the preflight's installed-app check (`SID_APP_CONTAINER_MATCH`) is the
  read-only device check. It reads the phone and installs or launches nothing. It
  has not been run.
- **Wording:** the 01 pins print `PRELIGHT CLEAN`. The 02 pins print
  `PREFLIGHT CLEAN`. The marker file name `PREFLIGHT-CLEAN` is unchanged.

## 7. Sequence

Each line is its own authorization.

1. ~~Founder adjudicates this design and rules R1–R5.~~ Done 2026-11-19.
2. Records act on the record-of-record branch: this design, the Act-01 / Retry-01
   dispositions, and the 02 preflight and run pins, with pin tests. No device act.
3. Read-only device check for R2 and R3.
4. Founder session at the Mac: set output to Mac Studio Speakers at volume 69,
   place the phone, declare geometry, run the preflight to `PREFLIGHT-CLEAN`.
5. Founder sets the authority values and runs the run pin: Phase A, then Phase B.
6. Records commit of the sealed run root (C3). Founder accepts or refuses the pin.
7. Only then: the fresh N=10 source-discrimination population (K0-C), under its own
   authority.

## 8. What the founder does in person

Steps 4 and 5 only. Roughly: switch the Mac's sound output, set volume to 69, put
the phone on a hard surface at a measured distance from the Mac Studio, keep the
room quiet and still, and start two scripts. No listening is involved; this is an
instrument measurement. The tone is audible and gated at 2 Hz.

## 9. Not authorized by this record

Any device act, including the read-only check in step 3. Running either pin. Any build or install of the SID organism. Any change to the batch script,
fixture, reader, thresholds, ladder, kernel, harness or driver. Recovering the stale
Builder claim `s-67080b39`. Any change to the product app or its audio stack.

## 10. Falsifiers for this design

- If C2 cannot be met without changing `k00-source-calibration-batch.sh`, the design
  is wrong as written and returns.
- If the installed organism cannot be shown to be the pinned build, calibration does
  not start (R2).
- If any 01 threshold, level or count would need to move to make 02 pass, the act
  returns `NO LEVEL PIN`. It is not adapted.
