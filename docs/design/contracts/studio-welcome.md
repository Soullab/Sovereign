---
room: Studio Welcome
human_activity: being invited — a new writer, before their first session, learning what the Studio is for and choosing where to begin
surfaces:
  - app/writers-studio/welcome/**
change_class: experiential
principles:
  - MAIA_OATH — no guru stance; MAIA offers observations, possibilities and questions, never verdicts
  - STUDIO_COPY_VOICE — describe what the person can do, not what the Studio is
  - INHABITABLE_ARCHITECTURE warehouse test — three ways in, one shown at a time, never every capability at once
  - MARKETING_CLAIM_DISCIPLINE — every capability named is Live; what is not live (automatic proofreading, whole-book reading) is said plainly
  - MAIA_SOVEREIGNTY_INVARIANTS — pushes the writer toward their own work and toward a human (Kelly, a copyeditor), not toward MAIA's centrality
reference_surfaces:
  - docs/design/contracts/studio-home.md
  - app/writers-studio/HomeView.tsx
shared_with_house: navy field with amber accent (never purple) · serif for the writer's own voice, sans for guidance · gesture language in human verbs ("Return to a book", "Begin a new work") · provenance voice — "every answer tells you what she read"
distinct_to_room: this is the only Studio surface addressed to someone who has not yet begun. It holds no Work and reads no manuscript; it is a threshold, not a room to stay in. Its single dominant action ("Open Writer's Studio") leaves it, and it is never part of the returning writer's path.
screenshot_desktop: docs/design/contracts/screenshots/writers-studio-welcome-desktop.png
screenshot_mobile: docs/design/contracts/screenshots/writers-studio-welcome-mobile.png
experience_verification: HARNESS WALK, 2026-11-21 — fictional database and fictional writer only (scripts/witness/ws-continuity-walk.sh). Signed out, /writers-studio/welcome redirected to /signin with next=/writers-studio/welcome; after signing in as the fictional writer the page returned and greeted "Fictional, your writing has more in it than you remember." from the account name. Choosing a path revealed only that path and brought it into view; no horizontal scroll at 375px. Screenshots taken headless at 1280x800 and 375x812 (x2) on that harness. NOT established, still OWED: a real new writer's experience of it (the founder will learn from writers what works); behaviour on the iOS app build.
authority: founder request 2026-11-21 — "if we could send her an interactive invitation that helps her move into the process", "On her Soullab account!", and "The more we can guide our new writers initially the better until we learn from them what works".
---

# Studio Welcome — Experience Contract

## What this room is for

A writer who has been invited, often with a book they wrote years ago and a new one starting, needs to know
what they are walking into before they walk in: that MAIA reads with them, that nothing changes unless they
change it, and where they might begin. This page answers that once, then sends them into the Studio.

## Arrival

> **<First name>, your writing has more in it than you remember.**

Where am I: an invitation to Writer's Studio. What is it for: spending time with your work alongside MAIA.
What is here: three ways to begin, a few first questions, and plain answers to the worries a new writer has.
Where can I begin: "Open Writer's Studio".

## Gestures

| Gesture | Language used | Why this wording |
|---|---|---|
| Choose a way in | "Return to a book I have written" · "Begin a new work" · "Both, in their own spaces" | Names the writer's situation, not a feature |
| Borrow a question | "Copy" | Lowers the blank-page moment of a first ask |
| Enter | "Open Writer's Studio" (signed in) | Names what will happen |
| Ask a human | "Write to Kelly" | A person, not a support form |

## Forbidden here

- promising that MAIA fixes, polishes or rewrites the writer's work
- collecting anything (forms, analytics, storage) about the visitor
- naming any member in source; the greeting comes only from the signed-in account
- a feature tour or capability grid

## The two brand tests

**Same house?** Yes: the Studio's navy field, amber accent and serif, and the same "every answer tells you what
she read" provenance voice the Ask column uses.

**Distinct room?** Yes: it is the only Studio page with no Work in it and nothing to edit; it reads as an
invitation, not as a workspace.
