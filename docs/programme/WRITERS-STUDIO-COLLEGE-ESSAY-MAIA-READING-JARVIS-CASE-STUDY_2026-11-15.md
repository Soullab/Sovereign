# College Essay Studio — "MAIA hasn't read this" · JARVIS loop case study (2026-11-15)

**Lane:** #1982 → Writer owner #1800 → release #1938 → beta PR #2283 (head `ceb845be0f`, reported live in production per #1893 note of 2026-11-15).
**Change:** PR #2286 (stacked on #2283): `247ecd6317`, `0029ad4319`.
**Status:** `SOURCE_FIXED / UNIT+SYNTHETIC_WALK_PASS / NOT_LIVE_WALKED / NOT_DEPLOYED`.
**Not authorized by this document:** merge, deployment, migration, beta grants, or any claim that the fix is live.
**Member data:** none read. The tester's pasted essay was never opened. The walk used invented text.

---

## 1 · OBSERVE: the member's report (captured before explanation)

A beta tester (adult parent, using the College Essay path) pasted an essay into Develop. The top of MAIA's column said
*"I haven't read this draft yet."* They circled it and wrote that they **could not find a button that tells MAIA to read it**. Their screenshot
also showed a "Read this chapter with MAIA" pill in the stage toolbar, about 300px to the left.

Evidence class: member witness + device screenshot. Primary data, not an anecdote.

## 2 · TRACE: the actual render ancestry

| What the tester saw | Source at `ceb845be0f` |
|---|---|
| "I haven't read this draft yet." + "Which ones?" | `CoverageLine.tsx` `coverageSentence()`, the `coverage` slot of `DevelopCompanion` |
| Long "MAIA reads the chapter you open only if…" line | `DevelopStage.tsx` `DevelopCompanion`, `data-develop-she-read` |
| *(nothing)* under those lines | the `reading` slot: `StageReadingCard` returns `null` unless `status === 'ready'` |
| The toolbar pill | `DevelopStage.tsx:286`, shown only when status is `idle` or `error` |

The panel told the writer what was missing, but the action to fix it was only in the toolbar, out of their sightline.

## 3 · ATTRIBUTE

**Broken crossing:** *coverage statement → reading request* inside MAIA's column. The capability existed (toolbar, handlers, checkpoint path),
so this was a disconnected seam, not a missing feature.

Records checked before building (steward §2–§4):
- The R3 off-source patch on #1800 already targeted the empty slot. Its SHA-256 matched before it was applied.
- **F1** ("Teach me" long sentences, 52/53) is listed as open on #1800 but is **already fixed** at `ceb845be0f`: essay-path, teaching-turn, doorway and arrival suites pass 79/79. **That #1800 item is stale.**
- The capacity hold ("~4.9 GiB free, no new builds") no longer applies: 37 GiB free at 2026-11-15 midday.
- Auto-reading stays off (`NEXT_PUBLIC_WS_AUTO_READ`, paid job). The fix keeps the existing rule: MAIA reads only when the writer clicks.

## 4 · CHOOSE / CHANGE

1. `StageReadingInvitation` (new, `DevelopStage.tsx`) fills the reading slot until a reading is ready: progress while reading, the error with a retry,
   or "Read this chapter with MAIA" / "Save checkpoint and read with MAIA". It uses **the same handlers and the same checkpoint-first path as the toolbar**:
   no new authority, consent path or cost.
2. **Duplicate-request guard.** A render test showed that two clicks in one React batch both reached the handler, because the controller's
   `chapterReviewBusy` is React state and is still stale at the second click. A synchronous `useRef` latch now lets only the first click through; it releases after 4s if
   the status never moves. Reverting the ref makes the test fail.
3. Found by the walk (below): `CoverageLine` said **"I've read all 1 sections of this draft"** for a one-section draft, which is most college essays.
   It now says "I've read this draft." / "This draft has changed since I read it."
4. Found by the walk: in the checkpoint case the column showed the stage's error telling the writer to *Choose "Read this chapter with MAIA"*,
   directly above a button labelled *"Save checkpoint and read with MAIA"*. It now says it once, in its own words.

## 5 · WITNESS: what has and has not been established

| Claim | Evidence | Class |
|---|---|---|
| Invitation renders in each state and calls the right handler | `developMaiaReadingInvitation.test.ts` 7/7, real component in jsdom | render test |
| Double-click asks once | jsdom test + **real mouse double-click** in the synthetic walk: 1 call logged | synthetic device walk |
| idle → reading → reading card; checkpoint → checkpoint handler once; failure → "Nothing in your writing changed" + retry | synthetic walk, built-in browser, real components bundled with invented text | synthetic device walk |
| No regression in Writer's Studio | `app/writers-studio/__tests__` 1721/1723; the 2 failures are identical on base `ceb845be0f` | unit/source |
| Types | no diagnostics in changed files (repo-wide debt elsewhere) | compile |
| **Works for a writer in the real Studio** | **not established**: no authenticated live walk; the local DB holds member rows, so none was attempted | — |
| **Live for the tester** | **no**: not merged, not deployed | — |

Synthetic walk instrument: esbuild bundle of `DevelopCompanion`, `StageReadingInvitation` and `StageReadingCard`, with a fake controller that mirrors
`P4R1DevelopView`'s `stageReading` derivation. It is kept outside the repo; it is a witness instrument, not product.

## 6 · REFLECT

- **The detector that mattered was the human one.** Every structural test passed before the report. The panel was "correct" (it said truthfully what MAIA had read)
  and still failed the person, because it told them what was missing and offered nothing they could do about it there.
- **A walk outranks a code-read, even a synthetic one.** Both extra defects (the "all 1 sections" wording and the checkpoint copy contradiction) were invisible in the diff
  and the unit tests, and obvious within a minute of using the column.
- **Meaningful negatives found a real bug.** The double-click test failed against the first implementation; the concurrency concern flagged on #1800
  was real at the component level.
- **Stale records are a hazard.** F1 and the capacity hold were both recorded as current, and both were wrong by midday.

## 7 · Discovered, not absorbed (owner decisions)

1. **Two stale source-text tests** (`stageQuietTopbar`, `p4r1RelationalDevelopGuidance`) fail on the base `ceb845be0f`. Both assert markup that later commits
   reshaped (`3c185e5498` added `ref={moreRef}` to the More menu); the features still exist. They need updating by the Develop owner.
2. **"Chapter" vocabulary on an essay.** "Read this chapter with MAIA" / "Section 1" for a college essay is a path-aware copy decision (studioPaths owner).
3. **The `data-develop-she-read` line** ("MAIA reads the chapter you open only if you have let her read your saved work…") sits between the coverage line and the
   invitation and is dense for a first-time writer. This is a copy/design decision, not changed here.
4. **Controller-level guard.** `readCurrentChapter`'s *prepare* branch sets `chapterReadPending` rather than `chapterReviewBusy`, so a second toolbar click
   during preparation reaches `prepare()` again (code-read only; whether `prepare()` is idempotent was **not** checked). The column's latch does not cover the
   toolbar. If confirmed, this would be a separate small change in `P4R1DevelopController.tsx`.

## 8 · Next exact acts (in order)

1. Review/merge #2286 into #2283's branch.
2. Authenticated live walk on a test account (not member data) of: paste essay → panel invitation → read → card; unsaved edit → checkpoint path.
3. Deploy through the canonical deploy gate when the founder rules on it; verify `GIT_COMMIT` on minisforum.
4. Tell the tester it is live only after step 3 is verified.
