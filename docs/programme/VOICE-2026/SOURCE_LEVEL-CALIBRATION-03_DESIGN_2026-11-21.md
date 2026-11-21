# VOICE-2026 — SOURCE LEVEL-CALIBRATION-03 — Design (2026-11-21)

**Status:** founder-directed 2026-11-21 ("Yes, set it up"). Records and tests only.
It authorizes no device act. The run needs its own founder authority at invocation.
**Parent:** Lane K · K0 (`VOICE_FULL_CLOSURE_RUNBOOK_2026-09-21.md`).
**Inherits unchanged:** `SOURCE_LEVEL-CALIBRATION-02_DESIGN_2026-11-19.md` §3–§5 and
§11–§12, and through it the 01 design §2–§7.

```text
Class: A
Governing authority: VOICE-2026 ARCH-01 (ratified 2026-09-11); Runbook Lane K, K0
Current gate: K0 — source visibility calibration
Evidence subject: SID organism faf918b5c (VPIO-02); implementation 07eec3053
Stop boundary: no device act until the founder authorizes the run at invocation
```

## 1. Disposition of the 02 act

`SOURCE-LEVEL-CALIBRATION-02`, invoked 2026-11-19 18:38:12Z:
**RETURNED · PHASE A L1 PASS 5/5 · PHASE B NOT RUN · NO LEVEL PIN.**

- Preflight `20261119T183704Z` was clean, including device identity and installed
  identity against the FIRST-INSTALL-04 record.
- The organism launched and sampled. This is the first population measured through
  this instrument since September.
- Phase A, L1, VP on, N=5: all five rows readable, V1 and V2 valid, ratios 33.57,
  33.81, 34.28, 34.95 and 32.48 dB in time order, median 33.81 dB against the 26 dB
  selection bar. `populationPass` true.
- Phase B (VP off, N=3) returned `rc=1` at its own precondition: the batch read
  `output volume:38`, not 69, at 18:41:45Z. No VP-off sample was taken.
- Because Phase B returned, the run pin wrote `RETURN` and did not write
  `SELECTED-SOURCE-PIN`. The act's authority is spent.

**The volume change: cause not established.** The batch verified 69 on Mac Studio
Speakers at 18:38:13Z and read 38 at 18:41:45Z. The founder did not change it. The
Mac's unified log for that window holds no volume or output-device event. On
2026-11-21 the default output was found to be the Bluetooth device `B06Ultra`, so
that device has taken the output at least once since; whether it did so during the
act is not known. The fifth row is 1 to 2.5 dB below the other four. That is
consistent with a change late in Phase A and is not proof of when it happened.

**What the 02 act establishes.** That the amended instrument, the September organism
and today's toolchain work end to end, and that the source is visible at L1 with
margin on at least four rows taken at a verified 69. It does not establish a level
pin. The five rows are evidence and are not promoted to a pin after the fact.

The 02 evidence root stays where it is, under
`~/voice-2026-witness/source-level-calibration-02/`. Its commit to this branch is a
separate reviewed act (02 design C3), with the process-list question still open.

## 2. Why a new full act, and not Phase B alone

The 02 run pin has no path that runs Phase B on a prior Phase A, and its marker is
spent. Attaching a VP-off characterization to a Phase A whose volume is not known
for all five rows would carry the doubt into the pin. A full act is short: L1
passed in three and a half minutes. Under the design's rule, **return, never adapt**,
the act is run again whole.

## 3. What changes from 02, and only this

| # | Change | Reason |
|---|---|---|
| D1 | New act identity `SOURCE-LEVEL-CALIBRATION-03`; new pin files, evidence root `~/voice-2026-witness/source-level-calibration-03`, marker and authority value | The 02 identifiers are spent |
| D2 | The run pin records output volume and default output device about once a second for the whole act (`volume-watch.tsv`) | The 02 act could not say when the volume changed |
| D3 | The run pin writes no level pin unless every watch row shows volume 69, unmuted, on Mac Studio Speakers; otherwise it returns with code 12 | A level measured while the output moved is not a level |

The preflight is the accepted 02 preflight under the new name, byte for byte
otherwise. The implementation, batch script, fixture, reader, thresholds, ladder and
organism are unchanged. The watch only reads; it sets no volume and selects no
device.

## 4. Authority values (founder sets them)

`K00_EXEC_AUTHORITY=FOUNDER-AUTHORIZED-SOURCE-LEVEL-CALIBRATION-03`,
`K00_CAL_OPERATOR_SAFETY=CONFIRMED`, and the five geometry declarations at preflight.

## 5. Before the run (operator)

While this design was being written the default output read `B06Ultra` and, minutes
later, `AirPods Max`: Bluetooth devices take this Mac's output on their own. That is
the leading candidate for the 02 volume change and is not proven. Switch off
Bluetooth on the Mac for the act, or power down both devices, so neither can take
the output. Close other
applications that play or route sound. Set Mac Studio Speakers, volume 69, unmuted.
Place the phone and declare geometry fresh.

## 6. Deadline

The signing certificate named in the September build records expires 2026-11-26
13:38 UTC. The 02 act showed the organism launches today.

## 7. Falsifiers

- If the watch shows drift again, the act returns and the cause is investigated
  from the watch file before any further act.
- If any threshold, level or count would need to move to make 03 pass, the act
  returns `NO LEVEL PIN`. It is not adapted.

## 8. Not authorized by this design

Any device act. Committing the 02 or 03 evidence roots. Any change to the batch
script, fixture, reader, thresholds, ladder, kernel, harness or driver. Changing the
Mac's sound settings by script.
