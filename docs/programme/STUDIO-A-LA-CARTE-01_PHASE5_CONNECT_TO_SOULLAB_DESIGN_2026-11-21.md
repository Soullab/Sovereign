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
   - **The honest mechanics:** you'll sign in once more at soullab.life with the same email and password. It's
     the same account, not a new one.
   - Two equal choices: **Continue to Soullab** · **Not now**. "Not now" is not recorded, counted or followed up.
3. **Sign-in at soullab.life** with `/signin?next=/connect/begin`, using the same credentials. A session on
   `writer.soullab.life` does not reach `soullab.life` (browser storage is per-origin). A cross-host handoff
   would avoid this second sign-in but is a Class A auth change and stays **held** (§7.2).
4. **The ritual (R4).** The universal onboarding as currently rendered, from the code read: elemental
   orientation → FAQ → `/onboarding` (preparation → birth data, already optional and skippable → welcome).
   Account creation, passkey and password are skipped because they are done. ⚠️ The `CLAUDE.md` description of
   this flow (`/begin → /intro-maia → /intro-daimon → /test-elemental …`) is out of date: `/begin` and
   `/test-elemental` redirect to `/signin` (since 2026-05-16), and `/intro-maia` and `/intro-daimon` no longer
   exist. **Before build, walk the live ritual and bind this step to what a new member actually sees.**
5. **Completion writes the connection.** The `connected` event (§4) is written at the **end** of the ritual, not
   the start. A member who stops halfway is still studio-only and can resume from the same door later.
6. **Arrival:** `/home` on soullab.life, as for every new member.

**Stepping back.** Studio settings shows **Step back from Soullab**, which writes `disconnected`. MAIA in Soullab
and any Studio-writing share end at once, and the Studio is untouched. What happens to memories formed in Soullab
is the member's choice (§7.1).

## 4. Data (proposal; migration not authorized)

An append-only event log, following the pattern already used for `writers_studio_beta_grant_events` and
`studio_holding_events`:

`soullab_connection_events (id, member_id, kind, studio, created_at, actor_member_id)`, with `kind` ∈
- `connected`: the ritual was completed on crossing;
- `disconnected`: the member stepped back;
- `studio_share_granted` / `studio_share_revoked`: MAIA in Soullab may / may not read this member's Studio
  writing. This is **off by default** and offered only after connection, never inside the ritual.

The current state is the latest event of each pair. There are no mutable flags, and the history is auditable.

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

1. **Memory on stepping back.** Should the member choose between *keep (dormant, returns if they come back)* and
   *erase*, with a stated default? Consent for memory says the member decides; the default needs a ruling.
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
