# STUDIO-A-LA-CARTE-01 — Phase 5: Connect to Soullab (design)

**Status:** `PROPOSED` design. ⛔ It authorizes no implementation, migration, route change, copy change, merge
or deploy; each needs its own authorization.
**Code read at:** canonical `origin/clean-main-no-secrets` @ `9f3527cbb`.
**Parent record:** `STUDIO-A-LA-CARTE-01_FOUNDER_RULING_R1_2026-11-12.md`. §2.4 says a studio member who later
connects to Soullab "meets the universal MAIA onboarding at that point". §4 row 5 says the "Connect to Soullab"
consent bridge must be explicit and revocable.

## 0. The question

Founder (2026-11-21): *"we need to find a process that will allow members who ordered the writers studio a la
carte access to Soullab without them feeling overwhelmed, obligated or confused."*

## 1. Ruling recorded here — R4 (founder, 2026-11-21: "Yes, full ritual")

**On first crossing into Soullab, a studio member goes through the same onboarding ritual every Soullab member
goes through, minus the account steps they have already completed.** There is one ritual for everyone. The
crossing is the threshold, and because the member chose to cross, the ritual is received as a welcome rather
than as an obstacle.

R4 settles which onboarding a crossing studio member meets. It does not settle the open questions in §7.

## 2. The three failure modes, and what prevents each

| The member must not feel… | Because… | So the design… |
|---|---|---|
| **Overwhelmed** | Soullab is large: MAIA, Field, House, Co-Labs, practices. | shows nothing of Soullab inside the Studio except one quiet line; opens it only when asked; and lets the ritual introduce it one step at a time. |
| **Obligated** | a purchase or an invitation can read as a debt, and repeated prompts read as pressure. | never prompts. No badges, counters, reminders, emails, "you haven't tried…" copy, expiring offers, or MAIA invitations. Stepping back costs nothing. |
| **Confused** | "same account, different place" is hard to picture, and a second sign-in looks like a second account. | states three plain facts before the choice (§3, step 2), and says honestly that they will sign in once more with the same email and password. |

This follows the Sovereignty Invariants: no attachment capture, consent for memory, upward-only authority
(Invariant 16). The Studio never moves a person into Soullab; it keeps a door they may open.

## 3. The member's path

**Who this concerns:** a *studio-only member*, meaning a member whose account was created at a studio door (a row
in `studio_doorway_redemptions`) and who has no completed connection (§4). Members who came through Soullab
first are unaffected by everything here.

1. **The door (inside the Studio).** One line in Studio settings / About, and nowhere else:
   > *Your account also opens Soullab, the wider home this Studio belongs to. Nothing there is on until you
   > choose.* — **About Soullab**

   No other surface links to it. The welcome invitation (`/writers-studio/welcome`) does not mention it.
2. **The preview: plain facts, no ask** (`/connect`, on the studio address). One short page:
   - **What Soullab is**, in two sentences and in the member's terms, not ours (Invariant 14).
   - **What changes:** you can talk with MAIA beyond your writing. A short welcome comes first, the same one every
     member has.
   - **What doesn't:** your Studio and your Works stay exactly as they are. MAIA in Soullab cannot see your Studio
     writing unless you separately choose to share it. You can step back at any time and your Studio is
     untouched.
   - **The honest mechanics:** *"You'll sign in once more at soullab.life with your existing Soullab account.
     It's the same account, not a new one."* This is identity-neutral wording: it does not promise a password,
     because a member may sign in another way.
   - **What connecting does not open:** connecting is not consent to anything else. It does not authorize
     manuscript or Studio access, Studio memories, Field participation, or expanded MAIA retention. Each stays its
     own choice, asked at its own boundary.
   - Two equal choices: **Continue to Soullab** · **Not now**. "Not now" is not recorded, counted or followed up.
3. **Sign-in at soullab.life** with `/signin?next=/connect/begin`, using the same account (whatever sign-in method
   the member uses). Before build, verify in a real browser that this second sign-in lands on the ritual. A session on
   `writer.soullab.life` does not reach `soullab.life` (browser storage is per-origin). A cross-host handoff
   would avoid this second sign-in but is a Class A auth change and stays **held** (§7.2).
4. **The ritual (R4).** The universal onboarding as currently rendered, from the code read: elemental
   orientation → FAQ → `/onboarding` (preparation → birth data, already optional and skippable → welcome).
   Account creation, passkey and password are skipped because they are done. ⚠️ The `CLAUDE.md` description of
   this flow (`/begin → /intro-maia → /intro-daimon → /test-elemental …`) is out of date: `/begin` and
   `/test-elemental` redirect to `/signin` (since 2026-05-16), and `/intro-maia` and `/intro-daimon` no longer
   exist. **Before build, walk the live ritual and bind this step to what a new member actually sees.**
   Do not rebuild the retired routes. Assess the experience itself: does it welcome someone into a different
   relationship with consciousness, or only advance them through informational screens? Whatever the walk
   finds, there stays **one living, universal welcome**, the same for members who arrive at Soullab directly and
   members who arrive through a studio. If it needs deepening, deepen it for everyone.
5. **Completion writes the connection.** The `connected` event (§4) is written at the **end** of the ritual, not
   the start. A member who stops halfway is still studio-only: nothing is recorded early, and they can resume
   from the same door later, where they left off.
6. **Arrival:** `/home` on soullab.life, as for every new member.

**Stepping back** is **disconnecting, not deleting**. Studio settings shows **Step back from Soullab**, which
writes `disconnected`. At once, MAIA in Soullab stops for this member: there is no access, no retrieval and no new
memory formed, and any Studio-writing share ends. The Studio is untouched. What happens to memories already formed
in Soullab is §7.1. Erasing them is a separate, plainly worded choice, never a side effect of stepping back.

## 4. Data (proposal; migration not authorized)

An append-only event log, following the pattern already used for `writers_studio_beta_grant_events` and
`studio_holding_events`:

`soullab_connection_events (id, member_id, kind, studio, living_work_id, created_at, actor_member_id)`, with
`kind` ∈
- `connected`: the ritual was completed on crossing;
- `disconnected`: the member stepped back;
- `studio_share_granted` / `studio_share_revoked`: MAIA in Soullab may / may not read **one named Work**
  (`living_work_id`, required and never null for these kinds). This is **off by default** and offered only after
  connection, never inside the ritual.
- `memory_reactivated`: after reconnecting, the member chose to let MAIA use their dormant Soullab memory again
  (§7.1).

⛔ **A share is for one Work, never for all of them.** Sharing one manuscript must never authorize reading any
other. There is no member-wide share and no "all my writing" option. This follows the Studio's existing
**per-Work reading permission**: inside Writer's Studio, MAIA reads a Work's chapters only after the writer grants
the standing reading permission for that Work; it is revocable, receipted, and suspended in Sanctuary
(`WS-DEVELOP-G6_READING_CONTINUITY_CENSUS_2026-11-09.md`). The bridge is a separate layer on top of that grant:
- **source-specific:** names one Work;
- **purpose-specific:** "MAIA may draw on this Work in Soullab conversations", stated in those words;
- **conjunctive:** valid only while both the Studio's reading permission for that Work and this bridge grant
  stand. Revoking either one ends it.

Stepping back from Soullab does not touch Studio-side reading permissions. They belong to the Studio.

The current state is the latest event of each pair. There are no mutable flags, and the history is auditable.

⛔ **Reconnection never revives an old permission.** A Work share, or the use of dormant memory, is valid only if it
was granted **after the member's latest `connected` event**. So every new connection starts with every share off
and memory dormant, even when an earlier grant survives in the history and was never revoked. The reader enforces
this rule ("granted after the latest connect, and not revoked since"), not the writer's tidiness. Tests must prove
that a pre-disconnect Work share and pre-disconnect memory use are both ignored after reconnecting, and that a
share for Work A never reads Work B.

**Why not reuse `members.onboarded`:** a doorway account is already `onboarded = true`. Its meaning is the Studio
sign-up, and the middleware depends on it so that a studio member is never pushed into `/onboarding`. Changing
its meaning would break the Studio door. Connection is a separate fact and gets its own record.

## 5. Gates (proposal)

- A studio-only member who reaches a Soullab surface directly (for example a bookmarked `soullab.life/maia`) is
  sent to the `/connect` preview, **never dropped into MAIA without the ritual**.
- `MaiaPresence` stays hidden on studio addresses (as now) whatever the connection state. Soullab is entered at
  soullab.life, not layered over the Studio (R1 §2.5, "shared organism underneath, not shared chrome on top").
- The member alone can write `connected`. No operator script may connect someone (consent cannot be delegated).
- Sanctuary invariants apply in Soullab from the first turn, exactly as for every member.

## 6. Not built, on purpose

- No "Soullab" item in the Studio navigation, no MAIA greeting in the Studio that points outward, no onboarding
  emails, no "complete your profile" prompts.
- No price, plan or upsell anywhere on the crossing. If anyone reaches out personally, it is Kelly, as a person.
- No analytics on who declined. Declining is not a datum.

## 7. Open questions (recorded, not decided)

1. **Memory on stepping back — the default needs a founder ruling.** *Recommended (external review, second pass,
   2026-11-21):* **retain dormant, never erase automatically, never reactivate silently.**
   - **Step back:** Soullab memory becomes inaccessible to MAIA (no retrieval, no new memory). The Studio is
     unchanged.
   - **Reconnect:** preserved memory stays dormant. The member may choose to let MAIA use it again, by explicit
     consent (`memory_reactivated`). Reconnecting alone never does it.
   - **Erase:** a separate, member-controlled action, with verified deletion under the strict-deletion authority
     (#1791 WS-BACKUP-ERASURE-01) and the deletion-safe backup work (#1793 WS-BACKUP-ERASURE-02).
   - **Restore:** no historical backup may revive erased information or a withdrawn permission.
   Not yet ruled. ⚠️ #1793 is itself design-only and open, so "erase" can be offered only to the extent that
   deletion is actually witnessed. The UI must not promise more than the backups can honour.
2. **Second sign-in vs. handoff.** v1 asks the member to sign in again at soullab.life. A one-time cross-host
   handoff token is smoother but is Class A (identity/auth) and stays held until separately authorized.
3. **`CLAUDE.md` onboarding text.** It describes retired routes. Amending it is a separate act (R1 §2.4 left the
   invariant text untouched on purpose).
4. **Other studios.** This design is written for Writer's Studio. Sound, Guide and Astrology Studio reuse it only
   when each opens.

## 8. Acceptance (before this could ship)

Per R1 §4 row 5: a consent review; Sanctuary invariants hold; the Co-Lab release gate passes with `0 failed`;
**connect and disconnect both witnessed** on a named deployed SHA. Plus an F6 walk by a writer who is not the
founder: door → preview → "Not now" (nothing recorded) → later Continue → sign-in → ritual → `/home` → back in the
Studio unchanged → step back → Studio still unchanged.

The walk also covers: leaving halfway through the ritual records nothing, and returning resumes it; after stepping
back, MAIA in Soullab neither reads nor forms memory for the member; and **reconnecting starts with the
Studio-writing share off**, even if one was granted before stepping back.

**Prerequisites:** PR #2371 (same-origin API on studio addresses) merged and deployed before `writer.soullab.life`
gets DNS. Then a live walk of today's universal first arrival (§3 step 4) before implementation is considered.

## 9. Revision — 2026-11-21, after external review

The founder shared an external review (ChatGPT). It **accepts** R4 and the v1 second sign-in, and **refines** the
consent architecture. Folded in above:
- the arrival must be experiential, not administrative, with one living universal welcome; the retired routes are
  not rebuilt (§3.4);
- identity-neutral sign-in wording (§3.2, §3.3);
- connecting authorizes nothing else (§3.2);
- interruption and resumption (§3.5);
- disconnecting is not deleting (§3, stepping back);
- **reconnection never revives an old share**, enforced by the reader (§4), which corrects the original event
  model;
- the recommended memory default is recorded as a recommendation awaiting the founder's ruling (§7.1).

Not changed by the review: updating `CLAUDE.md` after the live walk remains a separate act (§7.3).

## 10. Revision — 2026-11-21, external review, second pass

The founder shared a second pass of the same review. Folded in:
- **Shares are per Work** (§4): source-specific and purpose-specific, and valid only while the Studio's own reading
  permission for that Work also stands. The first draft's member-wide share would have let one shared manuscript
  open all of them; that is corrected.
- **Reconnecting never reactivates memory use** (§4, §7.1): dormant memory needs its own explicit consent after
  reconnecting.
- **The memory recommendation is now retain dormant, never erase automatically, never reactivate silently**
  (§7.1). It is still awaiting the founder's ruling.

**Production identity, reconciled.** A fresh read-only readback on 2026-11-21 shows the running `maia-sovereign`
container reporting `GIT_COMMIT=21a628987`, matching the `maia-sovereign:current` image
(`GIT_COMMIT=21a628987`), with the container created at `2026-11-21T19:08:57Z`. The Writer's Studio owner record
(#1800) citing `b8f5177f7` predates that deploy; it is stale, not contradictory. Any deploy of #2371 should bind
to a fresh readback at that time, not to this one.
