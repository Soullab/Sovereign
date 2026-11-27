# AI-NOS-OPEN-CORE-01 · ALIGN-R1 · J3-R1 — Fidelity-instrument repair lane

```text
Class: C (records + test/instrument repair; no member-facing, consent, memory-authority or production change)
Governing authority: founder ruling D-06, recorded on #1910 2026-11-26 (issuecomment-7207952105); ALIGN-R1 journey §5 J3 (merged #2414, corrected #2420); JARVIS Instructional Manual v1 §20, §27
Current gate: J3-R1.0 RE-ESTABLISH (re-measure the inherited reds at the current base; nothing is repaired)
Evidence subject: tests/constitutional/refusal-registry/** and the jest suites that fail, at origin/clean-main-no-secrets @ 448f66e92, run locally in an isolated worktree. Source-level and unit evidence only.
Stop boundary: any change to runtime behaviour on a member path, to an acceptance criterion, or to CI blocking policy; any model call, member data or deploy
```

**Parent flow:** ALIGN-R1 (strategic alignment journey) under AI-NOS-OPEN-CORE-01 #1910
**Reason opened:** a bounded need for instrument repair. The record found that the instruments meant to measure fidelity are red. While they stay red, no claim about fidelity, hallucination or sycophancy can be measured.
**Base:** `448f66e92` (tip of `clean-main-no-secrets` when this charter was drafted). Bind the exact SHA again when the lane acts.
**Standing:** ALIGN-R1 J0/J1 PASS (bounded census). Rulings D-01…D-06 are recorded. J2 is held for R1–R5. J4–J6 have not started. J7–J9 are on HOLD. J10–J11 are PARKED.
**Status:** PROPOSED charter. It has not been admitted, and no act has been taken under it.

## Gate question

Do the existing fidelity instruments tell the truth about the code they claim to guard? For each red, is the failure in **the intelligence** (the code violates the refusal or the pin), in **the instrument** (the detector, fixture or harness is wrong), or **unattributed**? And can each one be repaired without weakening the original acceptance criterion?

## Inherited evidence (not re-witnessed by this charter)

| Item | Recorded | Source |
|---|---|---|
| Refusal harness: 6 failures (R03, R-A5, R24) | 2026-11-25, identical on base `a93a34639d` and on the Bloom/Field Safety lane | `docs/PRIORITY_THREAD_LOG.md` 2026-11-25 entry |
| Jest: 11 failures across 4 suites, incl. `__tests__/voice-non-degradation.test.ts` PROBES (Deep-Intelligence Gate pin) | same | same |
| Refusal-16 (developmental-state shaping guard) not in CI | 2026-11-26 code-read | ALIGN-R1 journey §3 |
| Harness README last-run line: `2026-07-01 — 11 passed · 0 failed` (4 refusals) | stale; the registry now holds 30+ refusals | `tests/constitutional/refusal-registry/README.md:6` |
| No refusal-harness or jest step found in `covenant-gates`, `sovereignty-gate`, `canonical-pr-quality`, `jarvis-epistemic-guard` | 2026-11-26 grep of 4 workflows only | absence from a search, not proof of absence |
| `canonical-pr-quality.yml:42-49`: jest is deliberately non-blocking; measuring it is owned by **CANONICAL-PR-UNIT-GATE-02** | in source | workflow header |

## Stages (each one closes before the next opens)

**J3-R1.0 RE-ESTABLISH.** Make an isolated worktree at the bound SHA, run `npm ci`, then run `npm run check:refusals` and the four failing jest suites. Record the exact failing IDs and messages. If the count or the identities differ from the inherited record → **STOP** and report; don't reconcile the difference by story.

**J3-R1.1 ATTRIBUTE.** For each red, record one verdict: `INTELLIGENCE-DEFECT` · `INSTRUMENT-DEFECT` · `STALE-CRITERION` (the code changed under a ratified decision and the test still pins the old law) · `UNATTRIBUTED`. Each verdict cites the commit that introduced it (`git log -S`/bisect) and the governing refusal entry or canon clause. `STALE-CRITERION` is only a *proposal*: changing a criterion is a founder ruling (manual §3).

**J3-R1.2 REPAIR (instrument-side only, without further ruling).** Fix `INSTRUMENT-DEFECT` items, with a falsifier per fix: show that the repaired instrument still fails against a deliberately violating fixture. Each fix is its own commit, with no re-baseline and no deleted or skipped test. An `INTELLIGENCE-DEFECT` on a member path is **not** repaired here. It goes to the owning lane as a finding, because the change would touch runtime behaviour.

**J3-R1.3 VOICE PIN.** Give `voice-non-degradation.test.ts` its own adjudication. It pins the Deep-Intelligence Gate, so a true `INTELLIGENCE-DEFECT` here is **RED for voice** and is reported as that. It must not be repaired into green.

**J3-R1.4 CI PROPOSAL.** Prepare (don't apply) a proposal to run the refusal harness, including R16, as a blocking check. Coordinate with CANONICAL-PR-UNIT-GATE-02 rather than editing its workflow. Making a check blocking is a policy act and needs its own go-ahead.

## Instrument-class finding (carried, not resolved)

The refusal harness makes **source-level structural assertions** ("no code path exists"), per its README:15. It cannot detect a sycophantic or confabulating *response*. The record's falsifier for J3 (a deliberately sycophantic and a deliberately confabulating fixture must both fail) therefore needs a **behavioural** instrument, which does not exist yet. Proposing one belongs to a later stage (J3-R2) and needs its own ruling. It would decide whether probes may call a model (spend, engine choice under D-02) and keep fixtures fictional, with no member content. Until then, "serves without flattering" stays **Designed**, even if J3-R1 passes.

## In scope
- Re-running, attributing and instrument-side repair of the inherited reds; per-fix falsifiers.
- Updating the harness README's last-run line with the real result.
- A lane record and an evidence packet (manual §13).

## Out of scope
- Any runtime/member-path code change, prompt change or copy change.
- Changing, loosening or re-baselining any acceptance criterion; deleting/skipping tests; `typecheck:baseline --accept-current`.
- CI workflow edits (CANONICAL-PR-UNIT-GATE-02 owns jest-in-CI).
- New behavioural probes or the memo's seven measures (J3-R2, separate ruling).
- Security hold #1948 (Writer model-attribution refusal) → its owner; #1819; R20; #1898.
- Scoring members; a parallel evaluation framework.

## Required falsifier
For every instrument repaired, a deliberately violating fixture or source mutation must turn it red again. A repair that cannot be made to fail is not a repair.

## Exit
- **PASS (J3-R1):** every inherited red is attributed. Instrument defects are repaired with falsifiers, the harness and suites are green **or** each remaining red is an attributed intelligence defect handed to its owner, and the CI proposal is prepared. → This opens the J3-R2 behavioural-probe proposal for ruling. The claim about structural refusals may be stated as *measured on `<SHA>`*.
- **STOP:** the re-run doesn't match the record, or a red can only be "fixed" by changing a criterion or runtime behaviour. → Report to #1910. Everything else stays closed.
- **HOLD:** the voice pin is a true intelligence defect → voice changes stay RED under the Deep-Intelligence Gate until its owner repairs it.

## Authorization required to act
Admitting this charter (records PR) is one act. **Starting J3-R1.0** (worktree + test run, local, non-destructive) is a second, separate act. **Committing any repair** in J3-R1.2 is a third. Each needs the founder's go-ahead. Merge, CI policy and deploy are outside this lane.
