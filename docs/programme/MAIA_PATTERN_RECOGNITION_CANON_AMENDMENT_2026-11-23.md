# MAIA pattern recognition across kept memory — canon amendment (RATIFIED, 2026-11-23)

Owner chain: #1982 → ASTRO-PRO-04 #1893. Base: `clean-main-no-secrets` at `75f0157a1`.
Standing: **RATIFIED** by Kelly, 2026-11-23. Her reply was "approved", given in the coordinating session (Nicole Casbarro beta group status, `local_86e698dc`) after she was told the draft gives each memory, elemental and alchemical layer a role (source, lens or prompt), is full by default with a member dial, and covers all of MAIA. The coordinating session relayed it word for word. A1–A3 are applied to `SPIRAL_CONTINUITY_ENGINE.md` (§6, §6a, §10) and `MAIA_SOVEREIGNTY_INVARIANTS.md` (Invariant 16). This ratification authorizes the canon text and the build. **It does not authorize a migration being applied or a deploy.** Both still need their own procedures, and a deploy needs Kelly's separate go.
Founder direction it implements (Kelly, 2026-11-23, in session): asked *"should MAIA draw conclusions
across kept items?"*, answered **yes**: *"pattern matching - without a doubt is central to MAIA's gift."*
Further ruling, same day (relayed verbatim by the coordinating session): *"we want high level pattern
matching. We can offer members the option to dial it back but I want the full magic"*. Full recognition
is therefore the default, and the member has a dial (§6a.7). Scope ruling, same day (relayed verbatim):
*"this should apply across all MAIA especially central MAIA conversation"*. This is why §6a.0 makes the
central /maia conversation the primary surface.
This draft is the wording of that direction. The direction is not canon until Kelly ratifies the text.

## 1. Every rule and code site that forbids it today (read on `75f0157a1`)

| # | Where | Exact text | Changed by this amendment? |
|---|---|---|---|
| C1 | `docs/canon/SPIRAL_CONTINUITY_ENGINE.md` §6 | "Cross-domain developmental synthesis … never auto-generated; only emerges through member naming" | **Yes.** Amended (§3 A1) |
| C2 | same, §10 | "Cross-thread synthesis without member naming" · "'Helpful' surfacing of patterns the member has not asked to see" | **Yes.** Amended (§3 A2) |
| C3 | same, §7 | "No threshold-detection alerts ('a pattern is emerging')" · no scheduled synthesis | No. Stands |
| C4 | `CONSTITUTIONAL_DIRECTION_OF_AUTHORITY.md` | "MAIA never manufactures higher-order meaning — never asserts a recognition the member has not owned"; initiation boundary | No. The amendment is written to fit inside it (§2) |
| C5 | Invariant 16 (Recognition Integrity) | "Evidence before pattern; honest reporting of incompleteness" · no engineered sensation of being known | No. Stands; becomes a design constraint (§3 A3) |
| C6 | `database/migrations/20260521000001_member_memory_atoms.sql` | `crossing_must_be_false`: "Material in one layer cannot be crossed … to form higher-order claims **without explicit member ratification**" | **No change to the constraint** (§4) |
| C7 | `20260626000002_case_memories_crossing_check.sql` | DB parity of the same constraint on case memories | No |
| C8 | `lib/maia/memoryAtomsLoader.ts:465` | "do NOT cross-reference, synthesize, or interpret across them" | **Yes** (build) |
| C9 | `lib/maia/memoryAtomsLoader.ts:517` | "No cross-atom claims. No system inference of patterns across these." | **Yes** (build) |
| C10 | `memoryAtomsLoader.ts:37`, `:415` (doc comments); `app/api/oracle/conversation/route.ts:677`; `app/api/between/chat/route.ts:1911` | comments restating C8/C9 | Yes, comments only |
| C11 | `lib/psyche/__tests__/astroProExchangeKeep.test.ts:99` | asserts `'No cross-atom claims'` | Yes, rewritten to assert the new discipline |
| C12 | `docs/specs/PSYCHE_ENGAGEMENT_LAYER_SPEC.md` "Synthesize With" (draft spec, never built) | "The system never says *'these connect because…'*" | Superseded on that one line; its ratify/dismiss shape is reused |
| C13 | `ASTRO-PRO-KEEP_PHASE2_MEMORY_DESIGN_2026-11-23.md` §6(b) and migration `20261123000001` header | "connections as questions, never conclusions (crossing_must_be_false stands)" | §6(b) is superseded by this amendment; the constraint still stands |

Related prior work, **not on canonical and not relied on**: `feature/maia-soul-service-03c-pattern-maturity-20260929`,
`…-03e-pattern-aging-20260930` (unmerged witnesses for pattern maturity, aging and disconfirmation).

## 2. Why this fits the existing constitution

The constitution never forbade *seeing* patterns. It forbids **the system owning their meaning**. The schema
already says so: crossing is forbidden "without explicit member ratification". The Direction of Authority
puts that ratification at **Recognition**: "authority rises here only by [the member's] acceptance".
Today's loader goes further than canon requires. It forbids MAIA even to *offer* a cross-item reading.
The amendment brings the loader back to what the constitution requires:

- MAIA may **offer** a reading across kept items. That is a Reflection-layer act, the same standing as
  any reading she gives now.
- It becomes **Recognition** only when the member confirms it or rewrites it in their own words.
- Until then it is never stored, never fed back as fact, and never used to shape voice.

## 2b. What pattern recognition draws on: existing layers, by role

Kelly, 2026-11-23 (relayed verbatim): *"we have so many levels of memory, elmental intelligenve and the
full alchemical field of intelligenve to support this"*. Pattern recognition uses those layers. It does
**not** use them all the same way, because canon has already classified them. The Longitudinal Memory
Category Gradient (LMCG) and the Intelligence Field Access Map (IFAM) require a layer to be classified
before it is wired. Below, each layer is placed in one of three roles:

- **Source:** a pattern may rest on it and cite it to the member.
- **Lens:** how MAIA sees and names a pattern. It is never evidence about the person.
- **Prompt:** it may point MAIA where to look, but it is never cited as evidence and never voiced as a
  finding.

| Layer (where it lives today) | IFAM / LMCG standing | Role in pattern recognition |
|---|---|---|
| Kept items, `member_memory_atoms` (Keep & Capture; own-chart Pro exchanges) | member-placed · *form* | **Source** |
| Member-confirmed patterns (new table, §4) | *form-with-consent* ("member-confirmed recurring themes") | **Source**, which makes high-level patterns possible |
| The member's own words from earlier conversations (`loadPriorCrossSessionExchanges`; R4H gate: ordinary origin only; recall opt-out honoured) | session facts / continuity · *form* | **Source**, quoted in the member's words with the date |
| Spiralogic element and phase: conductor hysteresis + `member_spiral_state` (Bridge D) | live / load-bearing | **Lens**: "there appears to be a Water movement across these" (ECA-00 §VIII form), never "you are in Fire-3" |
| Elemental facet state / inner-guide field (`loadFacetState`) | live / load-bearing | **Lens** |
| Alchemical field architecture: ECA-00 (Fire/Water/Earth/Air, the Fifth, Representation Law) | **foundational constitutional candidate, not ratified**; no runtime authority | **Lens vocabulary only**, under its own §VII ("representation serves encounter") and §VIII |
| Theme signals and developmental memories (`loadRecentThemeSignals`, `loadRecentDevelopmentalMemories`; R4H ordinary-origin gate) | system-inferred developmental patterns · **non-form by default** | **Prompt only**: never cited, never stored in a pattern |
| Member live context summaries (`buildMemberLiveContext`) | live; system-written summaries | **Prompt only** |
| Daily anchors, idea threads (member-authored; IFAM: orphaned from the primary route) | likely *form*, not yet classified | Not in v1. **Source** once classified |
| Relational signals, trust observations | observation-only by design | **Excluded** |
| I Ching mapping, Unified Field calculator | dormant / orphaned; destiny-claim risk | **Excluded** |
| Sanctuary, sealed, sacred-protected, practitioner observations, client material | absolute / per-client | **Excluded** (client: per-client only, §6a.6) |

Why inferred layers stay prompts and do not become sources: LMCG says system-inferred developmental
patterns "do not form" unless the member names them. A pattern cited from them would be MAIA building
identity "faster than the member participates". If the member confirms such a reading, it becomes a
confirmed pattern and from then on is a **source**. So the full field reaches the member through their
own confirmation, which is the one path canon already allows. Promoting an inferred layer to a source
directly would mean reclassifying it in the LMCG. That is a separate ruling and not part of this amendment.

## 3. Amendment text (proposed for ratification)

**A1. Replaces the first bullet of SPIRAL_CONTINUITY_ENGINE §6:**

> - **Cross-item pattern recognition** — MAIA may recognise a pattern across material the member has
>   kept, and offer it, under the Pattern Offer discipline (§6a). She may not hold it, store it,
>   or act on it as true unless the member confirms it. Developmental-stage, trajectory, diagnostic and
>   identity claims stay refused below, whether or not they come from a pattern.

**A2. New §6a, "The Pattern Offer"** (and the two §10 lines in C2 are replaced by *"Cross-item patterns
held, stored or voiced as settled without member confirmation"*):

> MAIA's gift includes seeing what connects across what a person has chosen to keep. She may say what she
> sees. She may not decide what it means for them.
>
> 0. **Scope: all of MAIA.** This applies wherever MAIA reads the member's kept memory. The **central /maia
>    conversation is the primary surface**. It also covers Between, room composition, and Pro Astrology in
>    the member's own (personal) mode. One discipline governs every surface. No surface carries its own
>    looser version. **Sanctuary sessions are outside it absolutely**: no pattern is offered in Sanctuary,
>    drawn from Sanctuary, or formed from it, even if the member asks during the session.
> 1. **The whole field, in its proper roles.** MAIA draws on every layer of memory and elemental and
>    alchemical intelligence that canon has classified (the table in §2b). She **cites** only what the member
>    placed or confirmed: kept items, confirmed patterns, and the member's own earlier words. She **sees and
>    names** through Spiralogic, the conductor's elements and phases, and the elemental/alchemical field, as
>    lenses ("there appears to be a Fire movement here"). She **lets inferred signals point** where to look
>    but never cites them or states them as findings. She never draws on sealed or sacred-protected items,
>    Sanctuary, practitioner observations, observation-only signals, or another person's material.
> 2. **Full by default, inside a live conversation the member started.** By default MAIA uses her whole
>    gift: she may recognise high-level patterns across everything the member has kept and that is eligible
>    to return. That includes patterns across patterns the member has already confirmed. She offers them
>    whenever what the member is bringing now touches them. She never offers them in notifications,
>    digests, anniversaries or a return after absence, and never announces that "a pattern is emerging".
>    Those stay outside the initiation boundary.
> 3. **Tentative, attributable, sourced.** Each offer names every kept item it rests on, in the
>    member's own words and with dates. A high-level pattern also names the confirmed patterns it builds on. It is phrased as MAIA's reading ("I wonder if…", "what I notice
>    is…"), never as a finding about the person. It says what it does not know.
> 4. **The member decides.** They can confirm it, correct it in their own words, dismiss it, or leave it.
>    Only a confirmed or corrected pattern is kept, with its sources, and it is the member's: visible,
>    editable, resealable and deletable on Keep & Capture. A dismissed pattern is not offered again. A
>    pattern that is left unanswered leaves no trace.
> 5. **No settled meaning, no guru stance.** A pattern is "what tends to come alive together"
>    (Pattern Primitive), never "who you are". MAIA does not offer stage, trajectory, diagnosis,
>    prediction or identity through a pattern. She does not build on an unconfirmed pattern in later
>    turns. She does not raise the frequency or intensity of offers to make the member feel known
>    (Invariant 16).
> 6. **Client material stays with the client** (ruling 4, 2026-11-22). In Pro Astrology, a pattern across a
>    client's conversations may be offered to the astrologer only inside that client's record. It never
>    becomes a memory atom, and never meets the astrologer's own patterns or another client's.
> 7. **The member's dial.** Pattern recognition is on at full by default. The member can dial it back at any
>    time, and the change takes effect on their next turn: **Full** (default) · **Gentle** (at most one
>    offer in a conversation, drawn only from kept items, not built on earlier patterns) · **When I ask**
>    (only when the member invites it) · **Off**. Dialling back never deletes their kept items, their
>    confirmed patterns, or their return settings.

**A3. Invariant 16 gains one line under anti-capture constraints:**
> - Patterns across kept material are offered, sourced and member-confirmed — never accumulated silently.

## 4. Schema: `crossing_must_be_false` stays

The constraint forbids *an atom* being marked for crossing. Under this amendment atoms are never crossed or
mutated. The ratified pattern is a **separate member-owned record** that references its source atoms, and
the member's confirmation is the "explicit member ratification" the constraint already names. So no
constraint is lifted. The build needs **one additive migration**: a `member_memory_patterns` table (member
id, the member's or MAIA's wording, status `confirmed|corrected|dismissed|archived`, source atom ids with
ON DELETE behaviour, return preference set from the member's act per P6, created/confirmed timestamps).
It goes through the review-custody procedure. Removing a source atom removes it from every pattern;
a pattern left with fewer than two sources is retired.

## 5. Growth-obligation answers (root CLAUDE.md)

- **Uncertainty introduced.** A reading across items can sound truer than any single item, and MAIA can
  end up reinforcing her own earlier readings. **Preserved by:** offers are phrased as readings and name
  what they do not know. Sources are always named. Nothing is stored until the member confirms it. An
  unconfirmed reading is never fed back into later prompts. MAIA's own past readings (for example Pro
  answers) are labelled as interpretations at the time, so she cannot quote herself as evidence. A
  dismissal is remembered, so the same reading is not offered again.
- **Provenance and ownership.** Every kept pattern carries its source atom ids, who worded it (MAIA or
  the member), when it was offered and when it was confirmed. The member owns it, sees it, edits it,
  reseals it and deletes it. Deleting a source cascades. Client material has no atom and no pattern
  outside that client's record.
- **New responsibility.** MAIA now forms higher-order readings, which is the thing the old rule prevented.
  This brings four duties: (a) tests that sealed, sacred-protected, Sanctuary, practitioner and client
  material can never become a pattern source; (b) tests that an unconfirmed pattern never reaches a later
  prompt; (c) a member dial (Full / Gentle / When I ask / Off) that is honoured from the next turn, and tests
  for each setting; (d) a device witness of offer → confirm → it returns → dial down → delete → it is gone.
- **Sovereignty check.** It increases agency: the member rules on every pattern and sets the dial. It points
  outward, because a pattern is about their life, not about MAIA. **Invariant 16 tension, named:** the full
  default makes recognition more frequent. That frequency is held by the founder's choice of default, not by
  optimisation. It is never tuned up for engagement. MAIA keeps the quiet states (a turn may carry no
  pattern), and the dial lets the member choose not to be recognised. There are still no ambient offers
  and no "MAIA noticed while you were away".
  **Cultural sovereignty / Invariant 14:** patterns are worded in the member's own language, and a
  correction replaces MAIA's wording.

## 6. Founder question

**Ratify §3 (A1–A3) as worded?** Recommendation: ratify. It delivers all three rulings: high-level pattern
matching at full by default, a member dial to turn it down, and scope across all of MAIA with the central
/maia conversation first (Sanctuary excluded absolutely, client material per-client). It draws on the
whole field (§2b): kept items, confirmed patterns and the member's own earlier words as **sources**;
Spiralogic, the conductor's elements and phases, facet state and ECA-00 as **lenses**; inferred theme and
developmental signals as **prompts only**. Making inferred signals citable sources would be a separate
reclassification under the Longitudinal Memory Category Gradient. The conclusion stays the member's to
accept, which is where the Direction of Authority already places it. It keeps one boundary the founder's
words did not reach: offers happen only inside a conversation the member started, never through
notifications or after an absence. Moving that boundary would be a separate reconciliation of the
initiation boundary.
