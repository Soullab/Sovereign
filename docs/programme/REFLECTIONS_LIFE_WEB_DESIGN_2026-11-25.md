# Reflections as the Life Web — Design Proposal

**Date:** 2026-11-25
**Status:** Design principles **RULED** (founder, 2026-11-25: *"Accept all four"*). See §8. **Building the Web is NOT authorized** by these rulings. Nothing here is built, migrated or deployed. No canon is amended by this document.
**Origin:** Founder direction (Kelly, 2026-11-25): *"We want Reflections to be a 4D overview of their life to help them see how the tapestry of their lives is reflected"* and *"this is about the Indra's web of our lives that help us see the God between emerge."*
**Related, not depended on:** Soullab/Sovereign#2405 (Keep/Reflections links + Archived section, branch `feature/keep-archived-reflections-links`, unmerged at time of writing).
**Evidence class of this document:** code-read and canon-read only. No member content was read; no runtime or member witness was taken. Every claim about "what exists" below means "what the repository says", at checkout `fix/pro-soul-portrait-open-existing` (`6159b37de`).

---

## 0. The proposal in one paragraph

Reflections keeps its identity as a cabinet of personal gems, and gains a second way of looking at the same gems: **the Web** — the member's kept moments laid out across time, with the threads *they* have drawn between them made visible. Time is the fourth dimension: the member can move through their life and watch the web thicken, see where a thread first appeared and where it returned. Every thread on the web is a real, member-owned relation with visible standing (drawn by the member, or offered by MAIA and accepted by the member). Nothing on the web is placed there by system inference. What the founder calls "the God between" is not something the system draws or names; it is what the member may come to see in the *between* — the threads — when their own life is shown back to them faithfully. The web is the condition for that seeing, never its author.

---

## 1. What already exists (reused, not rebuilt)

| Piece | Where | What it gives the Web |
|---|---|---|
| Reflection capsules | `reflection_capsules` (`database/migrations/20260122000001_reflection_capsules.sql`), `lib/capsules/types.ts`, `/api/capsules` (member-scoped) | The **nodes**. Each has `createdAt`, `sourceType` (chat/voice/journal/astrology/…), `signals.element`, `pinned`, `archived`. |
| Reflections room | `app/reflections/page.tsx`, `components/reflections/ReflectionsFeed.tsx`, `ReflectionDetail.tsx`, contract `docs/design/contracts/reflections-room.md` | The **Gems view** stays the default arrival ("What mattered, kept."). The Web is a second view of the same room. |
| Facet crossings | `member_facet_crossings` (content-free: member, crossing id, source facet/id, target facet/id, time), `lib/house/facetCrossing.server.ts`, `components/house/FacetOriginTrail.tsx`, contract `docs/design/contracts/facet-crossings.md` | The **threads that already exist**: every time a member carried a Reflection into Changes, Decisions or Daily Anchor (and Journal/Ideas/Relationships/Dream crossings), a member-authored, dated relation was recorded. These are already member-authored edges. |
| Living Constellation contract v0.1 | `docs/design/contracts/LIVING_CONSTELLATION_CONTRACT_V0_1_2026-09-18.md` — **Candidate, not ratified** | The **thread grammar**: relation vocabulary (§7), "system may detect, only the member may grant standing" (§7), solid = member / dotted = MAIA candidate (§8), standing labels MEMBER-AUTHORED / MEMBER-CONFIRMED / MAIA-CANDIDATE / SOURCE (§9), "projection, not collapse" (§1). |
| Keep | `/maia/keep-capture`, `member_memory_atoms` | The other kept place. Its discipline is binding here: the member does **not** see "system-generated insights", "inferred patterns", "dashboard metrics". |
| Discuss with MAIA | `components/reflections/DiscussWithMaia.tsx`, contract `reflections-maia-handoff.md` | The **only** place MAIA may offer a candidate thread: inside a conversation the member opened over their own material. |
| Breakthrough marking | `member_memory_atoms.is_breakthrough` (member-marked) | Precedent for a Recognition gesture in shipped form. |
| MAIA pattern recognition draft | Sibling session note `maia-pattern-recognition.md` (draft `MAIA_PATTERN_RECOGNITION_CANON_AMENDMENT_DRAFT_2026-11-23.md`, uncommitted in another worktree; **not opened by this session**) | Proposes a member-owned table for **ratified** patterns referencing source atoms, a member dial (Full / Gentle / When I ask / Off), offers only inside member-started conversation, Sanctuary excluded. **Status: PROPOSED, awaiting founder ratification.** This design is compatible with it but does not depend on it. |

What does **not** exist: any relation between two Reflections; any relation between a Reflection and a Keep atom; any time-based view of Reflections beyond the date on each gem.

---

## 2. What the member sees and does

### 2.1 Two views of one room

- **Gems** (today's room, default arrival). Unchanged.
- **Web** (new). A quiet toggle in the room header: `Gems · Web`. Never the default; the member chooses to look at their life this way.

The Web is a view over the same objects. It never becomes a second home for them.

### 2.2 Time — the fourth dimension

The Web is laid out on a horizontal **time river** (vertical on mobile): oldest at one edge, now at the other. Each kept moment sits where it was kept. Three spatial dimensions carry meaning the member already owns:

1. **When** (position along the river) — `createdAt`, a fact.
2. **Where it came from** (lane / band) — the room it was kept from (Conversation, Voice, Journal, Astrology, …), a fact (`sourceType` and crossing `source_facet`).
3. **Its signature** — the elemental colour already shown on each gem (quiet provenance cue, per the room contract; never a score).

The fourth is **movement through time**: a scrubber (`Then ←→ Now`) lets the member replay their web. As they move the scrubber, gems appear when they were kept and threads appear **on the date the thread was drawn**, not the date of either end. The member sees not only what connects, but *when they first saw that it connected*. This is the honest version of "watching the tapestry emerge": the emergence shown is the member's own recognition over time, not a pattern the system found after the fact.

Spacing is time, not importance. Size does not vary by significance. Nothing is "featured". (Reflections contract: no inferred importance ranking.)

### 2.3 Threads

A thread is a relation between two kept things (Reflection↔Reflection, Reflection↔Keep atom, and the existing Reflection→Change/Decision/Anchor crossings). Each thread shows, on touch:

- its **words** — a relation from the vocabulary ("arose from", "returning with", "in tension with", "connected with", …) and optionally the member's own sentence;
- its **standing** — `You drew this` (solid) or `MAIA offered this · you accepted` (solid, with a small mark) — and its date;
- **Return to either end**, **Reword**, **Untie** (remove).

Three ways a thread comes to exist:

1. **The member draws it.** In the Web: select a gem, choose `Tie to…`, pick another, choose or write the words. In a Reflection's detail: `This connects with…`. Nothing is created by dragging, proximity, or opening two things together (LC v0.1 §7).
2. **Already-made crossings appear automatically as threads** — because the member already made them. A Reflection carried into a Change shows a thread to that Change, labelled with the crossing's own gesture ("Named a change"). This adds no new authority; it makes visible what the ledger already holds. (Note: the crossings contract says the ledger "does not create a universal graph". This design shows only the member's own crossings, inside the member's own room, as a member-requested view — see Question 3.)
3. **MAIA offers one; the member accepts it.** Only inside `Discuss with MAIA` or a `/maia` conversation the member started, only for eligible material, only if the member's dial allows it. MAIA's offer appears **in the conversation**, in words ("You kept this in March and this in September — both speak of leaving the house you grew up in. Do they belong together?"), with `Tie them · Change the words · Leave it open · Not these`. Until accepted it is **not on the Web at all** (Question 1 explains why not even dotted). A declined offer is recorded as declined and not offered again.

### 2.4 Threads gathering — "the between"

When several threads meet, the member may **name the gathering**: select threads or gems and choose `Name what's between these`. The member writes the name. That named gathering is a **Recognition** the member owns (same layer as a breakthrough mark). It shows on the Web as a soft field behind its members, carrying the member's words and date.

This is the designed place for "the God between". The system never names it, never suggests the name, and never uses the word *God*, *soul*, *destiny*, *calling* or any framework term unless it is the member's own word (Invariant 14). The founder's phrase is design intent, not interface copy. A member for whom the between is God will write God; a member for whom it is family, or land, or the work, or nothing namable, will write that, or leave it unnamed. Unnamed is a complete state.

### 2.5 What the member never sees on the Web

- clusters, themes, or "patterns" the member did not draw or accept;
- counts or density as the primary experience ("you have 42 threads");
- MAIA text on the Web itself — the Web has no narrator;
- anything from Sanctuary sessions, sealed material, client material, or relational/trust observations;
- a portrait, summary, or "your life story" generated from the web.

### 2.6 Quiet when empty

A member with five gems and no threads sees five gems on a river and the line: *"Threads appear when you tie things together."* No prompt to tie more, no nudge, no streak. Quiet states remain quiet (Invariant 16).

---

## 3. Constitutional layer of each part

Per `CONSTITUTIONAL_DIRECTION_OF_AUTHORITY.md` (Encounter → Reflection → Recognition → Living Field):

| Part | Layer | Why |
|---|---|---|
| Source conversations, transcripts, readings | Encounter | Raw material; never on the Web directly. |
| A kept Reflection (gem) | Reflection | Member's deliberate keep. |
| Time river, lanes, element colour | Reflection (display of facts) | Dates and provenance only; asserts no meaning. |
| Existing facet crossings shown as threads | Reflection → action already taken | Member-authored carrying; shown, not upgraded. |
| A thread the member draws | **Recognition** | Owned statement that two things belong together. |
| A MAIA-offered thread | none until accepted; then **Recognition** (member-confirmed) | Zero authority as a candidate; rises only by acceptance. |
| A named gathering ("the between") | **Recognition** | Highest thing the Web may hold. |
| Carrying a named gathering into Living Field | **Living Field** — separate act, in the Living Field room | See §4. The Web does not write Living Field. |

No part skips a layer. No part lets the system hold meaning above Reflection without the member's act.

---

## 4. Reflections or Living Field?

**Recommendation: the Web lives in Reflections. Living Field receives only what the member chooses to carry there.**

- Living Field is *"the current best member-authored expression of accumulated recognitions … the highest layer the system may carry outward"*. A web of every keep and thread is not that; it is the working ground beneath it. Putting the whole web in Living Field would collapse Reflection and Recognition into Living Field — the exact violation the canon names.
- Reflections already holds the nodes, already owns the crossings out (`ReflectionDetail` → Changes/Decisions/Anchor), and the founder named Reflections.
- The bridge is a single crossing, admitted like every other: from a named gathering, `Carry into my Living Field` → Living Field opens with the gathering visible as provenance and its own authoring space blank (the crossings contract's "source accompanies, does not author").
- The Living Constellation remains the cross-room grammar (same thread visuals, same standing labels) so the member's world looks like one world.

---

## 5. Growth-obligation answers

**What uncertainty does this introduce, and how is it preserved?**
- *A thread is not a truth about the member's life.* It is a statement the member made on a date. It shows its date and author, can be reworded or untied, and the Web shows threads as *drawn then*, not *true now*.
- *Absence is not evidence.* Gems without threads are not "isolated"; unthreaded periods are not "gaps". The Web never comments on its own shape.
- *MAIA's offers are hypotheses.* They carry no standing, never appear on the Web, and a refusal ends them.
- *The Web is incomplete by design.* It shows only what was kept; it is never "your life", and the room says so once, quietly: *"Only what you kept, only the threads you tied."*

**What provenance and ownership boundaries does this require?**
- Every thread stores: member, both ends (facet + id), relation words, author (`member` | `maia_offered_member_accepted`), created/changed dates — and **no copied prose, summary, score or vector** (crossings-ledger discipline).
- Threads are member-owned and member-deletable; deleting a gem unties its threads.
- Eligibility before display: Sanctuary, sealed, client and relational-observation material are excluded from both the Web and from MAIA offers (Invariant 11 protection precedence).
- The Web is never shared outward. Anything entering Living Field or the Developmental Ecology goes only by its own crossing.
- MAIA's reasoning for an offer is not stored as the thread's meaning; the member's accepted words are.

**What new responsibility does this capability create?**
- *Responsibility not to engineer felt recognition* (Invariant 16). A beautiful web of one's life is powerful; the design limits power by having no narrator, no nudges, no ambient growth, no density metrics, and by keeping the default arrival as Gems.
- *Responsibility for MAIA's offers.* An offer that connects two painful moments can wound. Offers require the member's dial, happen only in present conversation, are worded as questions, and are never made in Care-mode crisis states.
- *Responsibility to the member's cosmology* (Invariant 14). The interface never supplies spiritual language; the member names the between or doesn't.
- *Responsibility for durability.* Once members tie their life together here, losing threads is a real harm. Threads need the same backup and export discipline as capsules.

---

## 6. Build shape (for orientation only — not authorized)

If ratified, the smallest honest sequence would be: (1) the Web view with time river and existing crossings only — no new table, read-only, proves whether the time view itself serves members; (2) member-drawn threads — one additive, content-free relation table through review custody; (3) named gatherings; (4) MAIA offers, only after the pattern-recognition amendment is ruled on. Each step needs its own experience contract, a member/device witness, and the Co-Lab gate where applicable. None of this is authorized by this document.

---

## 7. Questions of principle for the founder

### Q1 (central). Who draws the threads of the web?

Options: (a) only the member; (b) MAIA suggests, the member ratifies; (c) the system draws them.

**Recommended ruling: (b), shaped as "MAIA may offer, only the member may tie."** Threads come into standing only by the member's act — drawing one, or accepting MAIA's offer. MAIA offers only inside a conversation the member started, under the member's dial, and an un-accepted offer never appears on the Web, not even dotted.

Why not (c): it is the "system writes your life" failure the Direction of Authority forbids, and it contradicts the Keep discipline ("no inferred patterns"). Why not (a) alone: the founder's ruling on pattern recognition ("I want the full magic", relayed) asks MAIA to help members see across their life; (b) keeps that magic inside the conversation where it can be questioned. Why not dotted lines on the Web (as LC v0.1 §8 suggests): a dotted line drawn on a picture of someone's life, while they are not in conversation, is ambient recognition from system initiative — the initiation boundary forbids it — and a dotted line is still felt as "the system thinks these belong together".

### Q2. Does the Web belong in Reflections, with Living Field receiving only carried gatherings?

**Recommended ruling: yes** (§4). The Web is a second view of Reflections; Living Field receives a named gathering only by its own admitted crossing, authored blank on arrival.

### Q3. May existing facet crossings be shown together as one picture?

The crossings contract says the ledger "does not create a universal graph or authorize automatic Field projection". Showing a member *their own* crossings as threads, in their own room, on request, is a projection, not a universal graph — but it is a new use of the ledger.

**Recommended ruling: yes, as a member-requested projection inside Reflections only**, limited to crossings that touch a Reflection, never projected into Living Field or any shared surface, and with a one-line amendment to the crossings contract recording this use.

### Q4. Does "the God between" appear in the product's language?

**Recommended ruling: no.** It is design intent. The interface offers `Name what's between these` and uses the member's own word for what they find. (Invariant 14.)

---

---

## 8. Founder rulings — 2026-11-25

Kelly ruled on §7 in the parent session on 2026-11-25, in these words: *"Accept all four."* Relayed to this session by the parent session; recorded here as relayed.

| Question | Ruling | State |
|---|---|---|
| Q1 — Who draws the threads? | **(b) "MAIA may offer, only the member may tie."** Threads gain standing only through the member's act. MAIA offers only inside a conversation the member started, under the member's dial. An offer that hasn't been accepted never appears on the Web, not even as a dotted line. | `AUTHORIZED` as design principle |
| Q2 — Reflections or Living Field? | **The Web lives in Reflections.** Living Field receives a named gathering only through its own admitted crossing, with its writing space blank on arrival. | `AUTHORIZED` as design principle |
| Q3 — May crossings be shown as one picture? | **Yes, as a member-requested projection inside Reflections only.** It is never projected into Living Field or any shared surface. The one-line amendment to `docs/design/contracts/facet-crossings.md` this requires is **not made here**. It belongs with the first build step that uses it. | `AUTHORIZED` as design principle; contract amendment `PROPOSED` |
| Q4 — Does "the God between" appear in product language? | **No.** It is design intent only. The interface offers `Name what's between these` and uses the member's own word. | `AUTHORIZED` as design principle |

**What these rulings do not authorize.** They settle the principles of the design. They do **not** authorize building the Web or any part of it. That covers the Web view, the time river, a thread table or migration, named gatherings, MAIA offers, the Living Field crossing, the facet-crossings contract amendment, or any canon change. Each step in §6 still needs its own authorization, experience contract, review custody and member/device witness. MAIA offers (Q1) also still wait on the separate ruling on the MAIA pattern-recognition amendment. Living Constellation v0.1 stays a candidate. Q1 departs from its §8 dotted-line suggestion for this room only, and that contract is not amended by this ruling.

---

*Stop point: proposal written, rulings recorded. No source, schema, canon, PR or deploy change was made. Not verified: the pattern-recognition draft text itself (location reported by a sibling note, not opened here); any member experience of a time-based view.*
