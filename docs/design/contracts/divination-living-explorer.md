---
room: Divination → I Ching Living Explorer
human_activity: after receiving a hexagram, choosing to learn where its images come from — its text, history, metaphysics, competing commentaries and casting practice — without the learning replacing the member's own meaning.

surfaces:
  - components/oracle/iching/**
  - components/oracle/atlas/**
  - components/oracle/ConsultationStages.tsx
  - app/oracle/atlas/**
  # The Atlas band added to the arrival; the arrival itself is governed by divination-room.md
  - app/oracle/page.tsx
  - app/oracle/divination-room.module.css

change_class: experiential

principles:
  - CONSTITUTIONAL_DIRECTION_OF_AUTHORITY — source text, tradition, scholarly commentary and member meaning remain distinguishable; every claim carries its evidence class
  - MAIA_OATH — symbolic material is offered as tradition to study, never as a verdict about the member's life
  - MARKETING_CLAIM_DISCIPLINE — no invented commentary; hexagrams without sourced commentary say so instead of filling the space
  - SOULLAB_READABILITY_STANDARD — divinationType tokens throughout; 14px floor for metadata

reference_surfaces:
  - docs/design/contracts/divination-room.md
  - docs/design/contracts/divination-readability.md
  - https://claude.ai/artifact/RZ7iTLyJAVsh2L2GRywC9g (Divination Studio design canvas, artboard 2 — I Ching chamber)

shared_with_house: warm/dark field, editorial serif hierarchy via divinationType, restrained gold wayfinding, provenance voice, explicit evidence labels.
distinct_to_room: the Explorer sits beneath the consultation, never before it. Five fields in tabs — The Text, History, Metaphysics, Commentaries, Practice — so depth is chosen rather than imposed. The stage rail (Ask · Cast · Receive · Explore) orients without navigating.

screenshot_desktop: docs/design/contracts/screenshots/divination-living-explorer-desktop.png
screenshot_mobile: docs/design/contracts/screenshots/divination-living-explorer-mobile.png
experience_verification: PARTIALLY WITNESSED. Founder walk 2026-11-15 on the worktree dev server (localhost:3021 and 192.168.4.36:3021): Atlas index seen on Safari desktop after the kicker fix (screenshot_desktop) and on iPhone Safari (screenshot_mobile), where the title, evidence key and three doors reflow to one column and stay readable. iPhone also: Runes index (history timeline with evidence badges; 24 runes in three ættir with þ, ï, ŋ rendering) and the Ansuz entry (glyph, facts, six layers in evidence order with solid → dashed → dotted borders, sources, tags, Thurisaz/Raidho neighbours). NOT YET WITNESSED: the arrival Atlas band, the chamber Explorer after a cast and its Open in the Atlas link, and hexagram and card entries. Full walk still owed: (1) /oracle, the new Atlas band below the three Chambers; (2) /oracle/iching through a full cast to the interpretation phase, checking each Explorer tab, keyboard tab navigation, the Open in the Atlas link, and that the MAIA chat below is unchanged; (3) /oracle/atlas and one entry each in I Ching, Tarot and Runes — all at desktop and mobile width. Partial witness 2026-11-15 (founder, Safari, localhost:3021): the Ask · Cast · Receive · Explore rail rendered on /oracle/iching in the question phase with Ask current. Partial witness 2026-11-15 (founder, Safari desktop, localhost:3021/oracle/atlas): Atlas index rendered inside the House threshold with breadcrumb, evidence key (five classes with strength bars), three tradition doors and the closing boundary note; one defect seen — door kickers inherited paragraph type and wrapped — fixed in the same session.
---

# Divination → I Ching Living Explorer — Experience Contract

## What this room is for

A member has asked a question and received a hexagram. Some members will want only that. Others want to know what the figure is: how old its words are, what the trigrams mean, why two great commentators read it in opposite ways, and how the casting method shaped the odds. The Explorer is that depth, kept beneath the reading so it never crowds the encounter.

## Arrival

> **Explore {hexagram name}**

Shown only in the interpretation phase, after Oracle's Wisdom, the changing lines and the ritual, and before the conversation with MAIA. It opens on The Text.

## Gestures

| Gesture | Language used | Why this wording |
|---|---|---|
| Choose a field | "The Text", "History", "Metaphysics", "Commentaries", "Practice" | Names of kinds of knowledge, not features |
| Orientation | "Ask · Cast · Receive · Explore" | The member's own movement through a consultation |

## Forbidden here

- Commentary written without a named source
- Presenting modern interpretation as ancient teaching
- Any claim that the hexagram predicts or decides
- Sending reading content anywhere (the Explorer is local and presentational)

## The two brand tests

**Same house?** Uses the Divination room's field, gold and divinationType hierarchy; reads as a continuation of the reading above it.

**Distinct room?** Yes — it is a study surface with evidence labels and sources, unlike the reading's interpretive voice or the MAIA conversation below it.
