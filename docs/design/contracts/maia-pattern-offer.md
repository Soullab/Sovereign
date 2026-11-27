---
room: MAIA Pattern Offer
human_activity: deciding whether a pattern MAIA noticed across what you have kept is true for you, and choosing how much MAIA should look for patterns
surfaces:
  - components/maia/PatternOfferCard.tsx
  - components/maia/PatternsSection.tsx
change_class: experiential
principles:
  - SPIRAL_CONTINUITY_ENGINE §6a — The Pattern Offer (ratified 2026-11-23): sourced, tentative, the member decides; Full by default with a member dial
  - CONSTITUTIONAL_DIRECTION_OF_AUTHORITY — a pattern rises to Recognition only by the member's acceptance
  - MAIA_SOVEREIGNTY_INVARIANTS Invariant 16 — patterns offered, sourced and member-confirmed, never accumulated silently; quiet states stay quiet
  - MAIA_SOVEREIGNTY_INVARIANTS Invariant 14 — "In my words" replaces MAIA's wording with the member's
reference_surfaces:
  - docs/design/contracts/maia-conversation.md
  - docs/design/contracts/house-return.md
  - components/OracleConversation.tsx (lens-switch consent buttons — same pill gesture and palette)
  - app/maia/keep-capture/page.tsx (Kept section — same list rhythm and stone palette)
shared_with_house: the navy conversation field and amber accent under MAIA's reply; Keep & Capture's stone list rhythm, small-caps section headings and quiet text actions; the same consent gesture language (pills under a reply) as the lens-switch ritual
distinct_to_room: the card always names what the pattern rests on, in the member's own words with dates, before asking anything; the three choices are equal-weight and "Not this" is never hidden; the dial is plain language about how much MAIA should look, never a score or a streak
screenshot_desktop: docs/design/contracts/screenshots/maia-pattern-offer-desktop.png
screenshot_mobile: docs/design/contracts/screenshots/maia-pattern-offer-mobile.png
experience_verification: "Component render, not a live walk. Both real components were bundled unchanged with fixture data (a mocked apiFetch), styled by the project's own tailwind.config.js, and captured in headless Chrome at 1280px and inside a 390px frame. Checked: sources are listed before the choices; the three choices read as peers; the 'Let go' and 'Kept' end states are quiet text; no horizontal overflow at 390px; navy field, never purple. NOT yet witnessed: the card under a real MAIA reply on /maia, the Keep & Capture section against a database with migration 20261127000002 applied, or a phone. That device witness (offer → keep → it returns → dial down → delete → gone) is owed before release."
---

# MAIA Pattern Offer — Experience Contract

## What this room is for

MAIA sometimes notices that things a person has kept seem to belong together. This
room is where the person decides whether that is true for them: keep it, say it in
their own words, or let it go. Separately, on Keep & Capture, it is where they choose how much
MAIA should look for patterns at all.

## Arrival

> **A pattern MAIA offered — yours to decide**

The member meets this under MAIA's reply, never on its own. The first thing they see
is what it rests on: their own kept items, quoted, with when they kept them.

## Gestures

| Gesture | Language used | Why this wording |
|---|---|---|
| Accept as offered | Keep it | Keeping is already the member's consent act everywhere in MAIA |
| Rewrite | In my words → Keep in my words | The member's language replaces MAIA's (Invariant 14) |
| Decline | Not this → "Let go. MAIA won't offer this one again." | Says plainly what the dismissal does |
| Dial | Full · Gentle · When I ask · Off | Plain description of how much MAIA looks, with the effect named under it |
| Manage | Put it in my words · Set aside · Only when I ask / Let MAIA bring it up · Remove | The same verbs Keep & Capture already uses for kept items |

## Forbidden here

- showing a pattern without its sources
- making "Keep it" visually louder than "Not this"
- counting, scoring or streaks for patterns
- any wording that presents a pattern as a finding about who the member is
- any of this inside Sanctuary
