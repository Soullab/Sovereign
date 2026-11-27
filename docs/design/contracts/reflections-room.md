---
room: Reflections
human_activity: returning to personally meaningful moments, words, recognitions, and keeps without reducing them to a content list
surfaces:
  - components/reflections/ReflectionsFeed.tsx
  - components/reflections/ReflectionsWeb.tsx
  - app/reflections/layout.tsx
  - app/reflections/reflections-room.module.css
change_class: experiential
principles:
  - INHABITABLE_ARCHITECTURE_STANDARD — member-owned material is experienced as a place of return, not exposed as a database listing
  - SOULLAB_THEME — the room shares the House field language while allowing a distinct emotional register
  - MAIA_OATH — kept material remains the member's own evidence; MAIA does not rank or reinterpret what matters merely by presenting it
reference_surfaces:
  - app/house/page.tsx — approved living House composition and membrane language
  - app/house/house.module.css — approved House typography, field depth, rules, and restrained Holoflower grammar
  - docs/design/contracts/journal-room.md — member-authored material remains primary and software recedes
shared_with_house: warm architectural field, dark translucent membranes, editorial serif hierarchy, restrained Holoflower wayfinding, quiet rules, and human-language gestures
distinct_to_room: Reflections is a private collection of personal gems — things the member deliberately kept because they mattered. It must feel collected and intimate rather than chronological, managerial, or feed-like.
screenshot_desktop: docs/design/contracts/screenshots/reflections-room-desktop.png
screenshot_mobile: docs/design/contracts/screenshots/reflections-room-mobile.png
experience_verification: >
  2026-09-26 founder visual walk on the live localhost:3597 House build. The prior white SaaS-like feed
  was rejected as dull, DIY, and list-like. The room was recomposed in place without changing capsule
  routes or persistence: warm House field, editorial arrival, subordinate search/filter controls,
  two-column kept-object composition, restrained elemental Holoflower signatures, and human-language
  actions. Founder reviewed the live render and accepted the direction with "that looks good!" after
  naming the governing metaphor: "these are like personal gems not a list." Desktop and narrow-window
  screenshots were captured from the exact accepted source before commit.
---

# Reflections — Experience Contract

## What this room is for

Reflections is where a member returns to things they deliberately kept because they mattered: a phrase, a recognition, a turning point, a remembered exchange, or a piece of writing that still carries charge. The room does not behave like a record manager. It holds these objects as personal gems — distinct, revisitable, and owned by the member.

## Arrival

> **What mattered, kept.**

The room opens as a private collection rather than a feed. Search and filtering are available, but they remain subordinate to the feeling of returning to meaningful objects.

## Gestures

| Gesture | Language used | Why this wording |
|---|---|---|
| reopen | `Return to this reflection` | names return rather than file navigation |
| pin | `Keep close` | expresses relational proximity rather than database state |
| pinned | `Kept close` | confirms the member's act in ordinary language |
| unfinished state | `Unfinished` | avoids software-centric `Draft` language in the collection view |
| archive | `Archive` | remains a plain custody action rather than being poetically disguised |
| continue relationally | `Meet MAIA →` | MAIA remains an optional relationship doorway, not the framing of the collection |

## Composition law

The collection may vary in visual height because the member's actual material varies in length. That variation must never imply importance, ranking, quality, or system judgment. Elemental color is a quiet provenance/signature cue, not an evaluative score.

**Crossing law:** Journal entries do not automatically become Reflection gems. A kept Journal entry enters this room through the member's explicit `Keep as a reflection` gesture. Historical auto-captured Journal capsules are preserved as existing custody; the repair is forward-looking and does not silently rewrite the member's archive.

## Forbidden here

- white SaaS page nested inside the House
- generic card-feed or list-management grammar
- emoji element badges
- importance ranking or "featured" reflections inferred by the system
- dashboard counts as the primary experience
- large action toolbars competing with the member's kept material
- MAIA interpreting or promoting one reflection merely because it is displayed

## The two brand tests

**Same house?** Yes. Reflections uses the approved House field, warm architectural depth, editorial type hierarchy, restrained rules, and Soullab Holoflower language.

**Distinct room?** Yes. The House is navigational and ecological; Reflections is intimate and object-centered. The member should feel they have opened a cabinet of things they chose to keep, not another House directory.

---

## Addendum — the Web view, Life Web step 1 (2026-11-26)

**Authority:** founder authorized building step 1 of `docs/programme/REFLECTIONS_LIFE_WEB_DESIGN_2026-11-25.md` §6 on 2026-11-26 ("Yes, build step 1"), under the principles ruled there on 2026-11-25 (Q1–Q4). Steps 2–4 (member-drawn threads, named gatherings, MAIA offers) are **not** authorized by this addendum. The facet-crossings contract carries the one-line Q3 amendment this step uses.

**What it is.** A second way of looking at the same gems. The room header offers `Gems · Web`. **Gems stays the default arrival**; the member chooses the Web. Nothing in the Web is a new object or a new store: it reads the member's non-archived Reflections and the crossings they already made that touch a Reflection. No new table, no write path.

**What the member sees.**

- A **time river** — horizontal on wide screens, vertical on phones — oldest at one edge, now at the other. Position is the date the reflection was kept, a fact.
- **Lanes** by where each reflection came from (Conversation, Voice, Journal, Divination, Astrology, …), a fact.
- Each gem as a small mark in its **elemental colour**, the same quiet provenance cue as the Gems view. All marks are the same size. Nothing is featured.
- **Threads** only where the member already carried a reflection into another room (a Change, a Decision, a Daily Anchor, a Journal entry). Each thread is labelled with the crossing's own gesture ("Name a change") and appears on the date it was made, not the date of either end.
- A **`Then ←→ Now` scrubber**: moving it back shows the river as it stood on that date — gems appear when they were kept, threads when they were made.
- Selecting a gem shows its title, source and date, `Return to this reflection →`, and any threads with `Return to …` links. No excerpt of the other end's prose is shown.
- One quiet line: *"Only what you kept, and where you carried it."* With no threads: *"Threads appear when you carry a reflection into another room."* No nudge to carry more.

**Forbidden in the Web view** (in addition to the room's list above): clusters, themes or patterns the member did not make; MAIA text on the Web; counts or density as the experience; size or position varying by importance; any thread not backed by a member-made crossing; dotted or suggested lines; Sanctuary, sealed, archived, client or relational-observation material; any projection into Living Field or a shared surface.

**Constitutional layer:** Reflection (display of facts: dates, provenance, member-made crossings). It asserts no meaning and holds nothing above Reflection.

**Experience verification:** **not yet witnessed.** Step 1 exists to prove whether the time view itself serves members; it is not `LIVE` until a member/device witness on the real build is recorded here.

**Engineering walk (2026-11-26) — not a member witness.** Local dev build on the Mac Studio, a synthetic test member (60 Reflections, 3 archived, 4 crossings out, 1 inbound), desktop 1280×860 and phone 375×812 emulation. Walked Home → Here · Now → Reflections → Gems → Web → Then/Now → a gem → Return to this reflection → Back, and a thread into Changes and back to source. The walk found and fixed: gems could not be selected (a global `svg { pointer-events: none }` rule), Back from a Reflection dropped the Web view, and on phones the lane names ran together, the touch area was small, and the detail opened out of sight. Load check: 1,000 Reflections and 300 crossings return in ~40 ms; rendering that many gems is slow and is an open finding. This walk does **not** satisfy the witness above.
