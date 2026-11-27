# AI-NOS-OPEN-CORE-01 · ALIGN-R1 — Full JARVIS Journey

**Generated applications, relational intelligence and the AIN OS critical path**

```text
Class: C (records / review only)
Governing authority: #1910 founder direction 2026-10-22 + founder "Yes, run review" 2026-11-26 (scope: read-only review)
Current gate: J1 CENSUS — PASS (bounded); J2 onward not opened
Evidence subject: origin/clean-main-no-secrets @ 30beb68864 (2026-11-26); packet AINOS_OPEN_CORE_R1 (sha256 514fa4c3…); #1910, #1982 comments to 2026-11-25
Stop boundary: no source change, worker dispatch, migration, member data, merge, deploy, or GitHub post
```

| Field | Value |
|---|---|
| Date | 2026-11-26 |
| Parent flow | AI-NOS-OPEN-CORE-01 (#1910), via SOULLAB-CONTINUITY-01 (#1982) |
| Why a lane, not a new programme | Manual §20 — the governing question is #1910's own (host-neutral, member-governed intelligence environment); success establishes no new kind of truth. |
| Inputs | Three founder strategy memos (ChatGPT-authored, 2026-11-26): *Age of infinitely generatable software*; *Beyond Applications*; *Serving without flattering*. Treated as **proposals**, not ratified decisions. |
| Production reference | `7591d87f2` cut over on minisforum 2026-11-25 per #1982 witness. **Not re-witnessed today.** Default branch is 3 commits ahead of it. |
| Status | PROPOSED record (content unchanged by admission). Custody: authored on `chore/ai-nos-align-r1-journey-20261126` off `30beb68864` (commit `09fbf640ac`); records PR Soullab/Sovereign#2414 merged into `clean-main-no-secrets` 2026-11-26 13:47 UTC (`d2f21e95a4`); pointers posted to #1910 and #1982. Founder rulings in session: "best practices" (= prepare only) · "Yes, open records PR" · "Yes, post pointers". Admission is custody, not ratification: D-01…D-06 remain open. |

---

## 0 · Governing question

> **Can Soullab truthfully say that a member's intelligence relationship — their Works, decisions, corrections and consent — belongs to them, survives a change of device and of model engine, and is reachable by any capability (ours, generated, or external) only through a governed grant, while MAIA's epistemic and relational fidelity is measured rather than asserted?**

That is the terminal claim beneath all three memos ("AIN OS governs the LLM, not the reverse"; "any application can participate"; "intelligence that serves without flattering"). Every gate below is a proposition that sentence depends on.

---

## 1 · Existing law (governs this journey; nothing here amends it)

- MAIA Canon v1.1, MAIA Oath, Sovereignty Invariants (incl. Invariant 14, 16), Constitutional Direction of Authority.
- Deep-Intelligence Gate (`MAIA_CONVERSATIONAL_INTELLIGENCE_NON_DEGRADATION.md`) — one mind across capture paths.
- Marketing Claim Discipline + Claim State Authority — *"We do not tell tomorrow's story as if it were today's."*
- #1910 north-star: One Work, two devices, two model engines; standing **ARCHITECTURE PASS / RELEASE, MEMBER DATA, DEPLOY HOLD**.
- #1898 Cabin Class A HOLD · R20 negative authority #1793/#1891 HOLD · #1819 LoRA HOLD · Writer #1800 and MAIA/privacy #1819 own implementation.
- Code-to-canon plan 2026-11-25 (records merged `a93a34639d`); rulings R1–R5 **open**.
- CLAUDE.md: self-hosted, no Supabase, "Never use OpenAI or other cloud AI providers"; Claude primary, local Ollama fallback.

## 2 · Explicit non-authorizations

Building a kernel, registry, SDK, capability layer or plugin system · opening any HOLD · new taxonomy · re-baselining tests · touching member data · public/open-source release or licence choice · any Heather/marketing use of memo language before J-claim review · dispatching JARVIS workers.

---

## 3 · What the code actually says (J1 census — code-read only)

Labels: **SRC** exists in source · **WIRED** imported by an `app/api` route · **TEST/DOC** only. None of this is a runtime claim.

### 3.1 Capability layer and Studios
| Finding | Label | Evidence |
|---|---|---|
| **No AI-NOS kernel, capability registry or inter-Studio contract.** Only hit is a test type name. | — | `git grep AINOS\|CapabilityRegistry…` → `tests/constitutional/serving-identity/disclosure-fact-production-contract-matrix.ts:62` |
| `lib/ain/` is an oracle/consciousness module set, not a hosting layer | WIRED | `app/api/oracle/conversation/route.ts:103-108`, `app/api/ain/*` |
| Only real grant contract: frozen Elemental Alchemy retrieval grant | WIRED (indirect) | `lib/ain/knowledge/GovernedSelectionGrant.ts:24-34` → `app/api/sovereign/app/maia/list/route.ts:177` |
| **Every Studio queries Postgres directly behind its own gate** (Writer, Book, Astrology, Divination, Sound, Pro/Practitioner: ~121 + 63 routes) | WIRED | e.g. `lib/astrology/proRouteAccess.ts:23`; `members.astrology_consent` `app/api/astrology/pro/my-chart/route.ts:110` |
| Composition-like structures are navigation only | WIRED | `lib/house/catalog.ts:16-37` (HOUSE_PLACES), `lib/studios/doorways.ts:28-34`, env flags |
| Nearest cross-Studio data crossing | WIRED | `lib/house/facetCrossing` / `member_facet_crossings` |
| **Competing owners — memory:** MemoryManager, MemoryOrchestrator, UnifiedMemoryInterface, mem0, MemberLiveContext, RelationshipMemoryService, memory-keeper, secondbrain, ain-recall; only 2 reach routes | mixed | `lib/memory/*` |
| **Competing owners — consent:** ~8 consent tables + a column, 6 consent libraries | mixed | `user_consent_log`, `runtime_consent_state`, `encounter_consent_events`, `soul_portrait_consents`, … |

### 3.2 Models, MCP, external access, Cabin
| Finding | Label | Evidence |
|---|---|---|
| No single provider seam: ~60 files `new Anthropic(`, **23 non-archive files `new OpenAI(`** (incl. `app/api/voice/openai-tts/route.ts`), no Gemini | SRC/WIRED | conflicts with CLAUDE.md "Never use OpenAI" |
| Nominal seam `generateText()`; **silent Claude→local fallback** on failure | SRC | `lib/ai/modelService.ts:101,236-246` |
| `sovereignRouter` primary mode logs `silent_fallback` drift but does not ask the member; sovereign/local_only never go to cloud | SRC | `lib/ai/sovereignRouter.ts:106-121,140` |
| No fallback is gated by a member grant — env flags only | SRC | `MAIA_TEXT_PROVIDER`, `MAIA_INFERENCE_MODE` |
| MCP: three stdio **servers**, none mounted by the app, AIN tools stubbed, no MCP client | SRC | `mcp-servers/ain/src/index.ts:123-225` |
| **No external developer surface** (no OAuth provider, key issuance, SDK); `x-api-key` middleware unimported | SRC | `lib/middleware/ApiMiddleware.ts:139` |
| Member memory protected by session + tier/role, **not per-request grants or receipts** (outside Writer) | WIRED | `lib/security/requireAccess.ts:138`, `lib/auth/tierAccess.ts:137+` |
| Body-trusted capture identity is dev-only, refused in prod | WIRED | `lib/capture/captureAuth.ts:104-112` *(survey overstated this; corrected)* |
| Cabin: plain `node:sqlite` WAL, **no at-rest encryption**; offline routes env-gated; one-way unsigned export/import; no sync, CRDT, conflict, or grant revocation | SRC/WIRED | `lib/cabin/localStore.ts:4,221-222`; `app/api/cabin/*`; `maia-desktop/src/main.js:107` |

### 3.3 Writer's Studio — the strongest asset
| Finding | Evidence |
|---|---|
| Append-only revisions (UPDATE refused in DB) | `database/migrations/20260727000001_manuscript_working_drafts.sql:27,41-60` |
| Author decisions as events bound to version | `20261108000002_writer_decision_events.sql:16-30` |
| Corrections = new turns, never edits | `20260901000001_ask_threads.sql:74-95` |
| **Receipted, revocable, no-inferred-default Work read scope** — the only member-level grant pattern in the product | `lib/manuscript/ask/workReadScope.ts:1-20` |
| Model recorded per turn — **but provider hard-typed `'anthropic'`** | `lib/manuscript/ask/askReader.ts:253-256` |
| Stale two-tab writes refused, nothing merged | `lib/manuscript/draftConcurrency.ts` |

### 3.4 North-star clause scorecard (#1910)
| Clause | Status |
|---|---|
| Create a Work offline | **ABSENT** |
| Reopen from an encrypted local vault | **ABSENT** |
| Local MAIA, no silent cloud fallback | **ABSENT** for Writer (Anthropic-only) |
| Reconnect with signed/retrievable ACK | **ABSENT** (nearest: ed25519 recovery manifest `lib/recovery/writerSourceRecoveryAuthority.ts`) |
| Two-device conflict without changing author intent | **PARTIAL** (refuses, does not resolve) |
| Transfer to a second engine with continuity | **PARTIAL** (model recorded; no seam) |
| Withdraw grant; old backup cannot reintroduce | **PARTIAL** (scope revocable; no tombstone/crypto-shred) |

### 3.5 Substrate and epistemic state (code-to-canon plan, 2026-11-25)
- Covert Bloom steering removed and production-witnessed for **one founder turn** (`7591d87f2`).
- Still live per the plan: unmarked Unified Field placeholders on FAST; single-label elements classifier defaulting to Earth; 89 element literals; Aether as fifth peer **against ECA-00 Fifth-Field Law**.
- Dormant: awareness ladder (`bead_events` 0 rows), Bloom Field-Safety gate (`cognitive_turn_events` empty, writer HELD), `extractTeloi`.
- **Measuring instruments are red:** refusal harness 6 failures (R03, R-A5, R24); jest 11 failures incl. `voice-non-degradation.test.ts` — the Deep-Intelligence Gate pin. Refusal-16 not in CI.

### 3.6 Governance custody
- `JARVIS_STEWARDSHIP_CONSTITUTION_2026-08-12.md` exists **only on unmerged branch** `chore/jarvis-stewardship-custody` (`fb8fb0833e`). Not on default.
- `JARVIS_FOUNDER_ESCALATION_CONTRACT_2026-08-12.md` — **found in no commit on any ref.** The global JARVIS Core cites both as governing.
- No root LICENSE; `package.json` private; mixed MIT sub-packages; no documented public/private source boundary or weights-licence policy.

**J1 adjudication: PASS (bounded).** *This proves* the census of what source contains at `30beb68864`. *It does not prove* runtime behaviour, member experience, that dormant code is unreachable, or anything about production today.

---

## 4 · Reading the memos against the census

| Memo proposition | Claim state today (Claim Discipline) | What makes it true |
|---|---|---|
| "AIN OS governs the LLM, not the reverse" | **Vision.** Today the LLM is called from ~80 places; fallback is env-driven and partly silent. | J5 model seam + J3 fidelity instrument |
| "Any application can participate without raw memory access" | **Vision.** No external surface exists; Studios themselves read raw tables. | J4 ownership → J6 grant contract |
| "Writing can inform creative exploration, where permitted" | **Designed (Writer only).** The receipt pattern exists for one Work; nothing crosses Studios under a grant. | J6 |
| "Intelligence that serves without flattering"; hallucination/sycophancy measures | **Partly Live, mostly Designed.** Refusal harness + R32 exist; covert steering removed for one witnessed turn; instruments red. | J3 |
| "Continuity belongs to the member, not the model provider" | **Vision.** Cabin unencrypted, no sync, Writer Anthropic-typed. | J7–J9 |
| Five elements incl. "Aether — the relational whole" as peer | **Contested.** Code treats Aether as a fifth peer, which the plan finds contrary to ECA-00. Memo language must not ship to marketing until R3. | R3 ruling |
| Generative / composable Studios; developer ecosystem; four markets | **Vision, unratified.** Correctly labelled as proposals by the memo. | J10–J11, PARK |

The memos are directionally consistent with #1910 and the cultivation charter. Their strongest claim — *we already have the architecture* — is the one the code does not yet support. The **substance exists in Writer's Studio**, not in a general layer.

---

## 5 · The journey (gates)

Each gate uses manual §19 fields, compressed. "Opens" means *may be proposed*, never *is authorized*.

```text
J0 ORIENT ─ J1 CENSUS ─┬─ J2 SUBSTRATE (existing lane) ─┐
                        ├─ J3 FIDELITY INSTRUMENT ───────┤
                        └─ J4 OWNERSHIP ─────────────────┴─ J5 MODEL SEAM ─ J6 GRANT CONTRACT
                                                                     │
           J7 CABIN 1-WORK/1-DEVICE (HOLD) ─ J8 TWO DEVICES (HOLD) ─ J9 SECOND ENGINE + REVOCATION (HOLD)
                                                                     │
                                              J10 COMPOSED SPACE (PARK) ─ J11 OPEN CORE (PARK)
```

### J0 · ORIENT — **PASS**
Custody bound: default `clean-main-no-secrets` @ `30beb68864`; `7591d87f2` is its ancestor; packet hash matches #1910; local checkout is on an unrelated feature branch with uncommitted changes (untouched). *Proves* referents. *Does not prove* live host state.

### J1 · CENSUS — **PASS (bounded)** — §3 above.

### J2 · SUBSTRATE — *dependency on the existing code-to-canon lane, not a new act*
- **Question:** Does MAIA's live intelligence path conform to ratified canon (no covert steering, no unmarked placeholders, one element taxonomy under ECA-00)?
- **Owner:** code-to-canon reconciliation (#1982 pointer chain). **Authority:** founder rulings R1–R5.
- **Evidence:** per-path production markers over more than one turn and more than one tier.
- **Falsifier:** any FAST/CORE/DEEP turn injecting un-member-marked framework content.
- **PASS opens:** J5 can rely on a single substrate. **STOP:** J5 waits.
- **Human stop:** R1–R5.

### J3 · FIDELITY INSTRUMENT — *instrument-repair lane (manual §20)*
- **Question:** Can we measure epistemic and relational fidelity — unsupported certainty, sycophancy/collusion, covert steering, displacement of judgment — such that a regression fails CI?
- **Subject:** existing refusal harness, `REFUSAL_REGISTRY.md`, R32, `voice-non-degradation.test.ts`.
- **Permitted (once opened):** repair the 6 refusal + 11 jest reds **as attributed defects**; bring Refusal-16 into CI; *then* propose new probes for the memo's seven measures (epistemic fidelity, relational fidelity, correctability, developmental sensitivity, contextual continuity, sovereignty, integrative capacity) as **registry entries**, not a new framework.
- **Forbidden:** re-baselining away reds; a parallel evaluation system; scoring members.
- **Falsifier:** a deliberately sycophantic and a deliberately confabulating fixture response must both fail.
- **PASS opens:** "serves without flattering" may move from Designed toward Live **for the measured paths only**.
- Why early: it is the one memo claim that is already half-real, and the Deep-Intelligence Gate pin is red — that bears on every voice and engine change after it.

### J4 · OWNERSHIP — *decision gate (JARVIS Core §D)*
- **Question:** Which single service owns (a) member consent and (b) member context, so that a grant layer has one thing to govern?
- **Evidence:** importer maps for the ~9 memory systems and ~8 consent stores (§3.1); dead-code confirmation by reachability, not grep.
- **Forbidden:** adding a ninth consent store or a "unified" wrapper before ownership is ruled.
- **PASS:** a ruled owner per truth. **Human stop:** D-03.

### J5 · MODEL SEAM — *design/contract first*
- **Question:** Is there one provider seam for member-facing turns, recording engine per turn, where any cloud↔local switch is either forbidden or member-visible — never silent?
- **Subject:** `lib/ai/modelService.ts`, `lib/ai/sovereignRouter.ts`, Writer `askReader.ts` provenance type.
- **Contract:** provider becomes a recorded value, not a type literal; `silent_fallback` becomes a refusal or a disclosed event; OpenAI call sites resolved per D-02.
- **Falsifier:** kill the primary engine mid-turn; the member-visible record must show the switch or the turn must decline.
- **Must not** break the Deep-Intelligence Gate (one mind across engines is the same law as across capture paths).
- **Owner:** MAIA #1819 / Writer #1800.

### J6 · GRANT CONTRACT — *design/contract only*
- **Question:** Can any capability — a Studio, a generated app, an MCP tool — reach member context only via a purpose-, scope- and time-bound grant with a receipt and revocation?
- **Seed (reuse, don't invent):** Writer `workReadScope` (receipted, revocable, no inferred default) + #1910's 60-case fictional `app-ports` conformance contract + R1/R2 fictional orchestrators (46 + 28 tests).
- **Falsifier:** a capability holding a valid session but no grant must get nothing; a revoked grant must stop a stream already in flight.
- **Forbidden:** a registry, SDK, or external API surface. Contract and conformance tests only.
- **PASS opens:** proposal for **one internal** crossing (e.g. Writer → House facet) under grant, as the first real composition.

### J7 · CABIN ONE-WORK / ONE-DEVICE — **HOLD (#1898 Class A)**
Encrypted local store, verified independently; one Work created offline and reopened. Reopens only on founder lift of #1898.

### J8 · TWO DEVICES — **HOLD**
Signed/retrievable operation ACK; genuine conflict resolved without changing settled author intent (builds on `draftConcurrency` refusal semantics).

### J9 · SECOND ENGINE + REVOCATION — **HOLD (R20 #1793/#1891)**
Transfer a Work to a second admitted engine (local) with continuity witnessed by the author; withdraw a grant so an old backup cannot reintroduce content. **Passing J5–J9 together is the #1910 north star.**

### J10 · COMPOSED SPACE — **PARK**
Member-assembled space (e.g. memo's Dream Studio) from **approved capabilities only**, no generated code with data access. Reopens after J6 PASS and a member witness of one internal crossing.

### J11 · OPEN CORE — **PARK**
Licence/IP/weights audit (#1910 decision 2), public/private boundary, developer docs. Reopens only after J6 and an owner/legal ruling. Claude Apps experiments (e.g. Heather's campaign planner) stay on **fictional or non-sensitive data, outside Soullab credentials**, until J6 exists.

### Witness rule for every gate
Code PASS → runtime trace → member/author witness. *A technical PASS cannot override "it still feels like it forgot me."*

---

## 6 · Critical path (prioritised)

1. **J3 instrument repair** — cheapest, already-owned, and it is the precondition for trusting any later claim about sycophancy, hallucination or engine change. Deep-Intelligence pin is red now.
2. **J2 rulings R1–R5** — founder time, not engineering time; unblocks the element taxonomy that the memos lean on.
3. **J4 ownership ruling** — before any grant layer, or the grant layer becomes the ninth owner.
4. **J5 model seam in Writer only** — smallest place where "two engines" can become true; provenance already recorded.
5. **J6 grant contract** generalised from `workReadScope`.
6. Founder decision on **#1898 lift path** — everything in J7–J9 waits on it.

What the memos call "Phase 01 — Recover and unify" is J2–J4. "Phase 02 — Prove relational continuity" is J5 + the Writer half of J9. The memo order is right; this journey adds that **the measuring instrument (J3) must be repaired before the proof means anything.**

---

## 7 · Discovered, not acted on (owner routing)

| Item | State | Route to |
|---|---|---|
| 23 non-archive files call OpenAI vs CLAUDE.md prohibition (incl. live `voice/openai-tts`) | DISCOVERED | MAIA #1819 / D-02 |
| Silent Claude→local fallback in `modelService`; `silent_fallback` in primary mode | DISCOVERED | J5 |
| Stewardship Constitution only on unmerged branch; Escalation Contract absent everywhere | DISCOVERED | D-04 |
| ~7 memory systems with no route importers | DISCOVERED | J4 |
| AIN MCP server unauthenticated beyond env key list, in-memory audit, stubbed tools — unmounted | DISCOVERED | J11 |
| Refusal harness + jest reds (pre-existing, already recorded 2026-11-25) | DISCOVERED (known) | J3 |

---

## 8 · Founder decision docket

Each is one question of principle with a recommended ruling. None is decided by this document.

**D-01 · Placement.** Run this journey as lane ALIGN-R1 inside #1910, not a new "AIN OS strategy" programme?
*Recommend:* **Yes.** Same governing question; a new programme would create a second owner.

**D-02 · OpenAI rule.** CLAUDE.md forbids OpenAI; 23 source files use it, one on a live route. Is the rule still law (→ files become defects for #1819) or superseded by a model-independence principle that admits GPT/Gemini as *governed engines*?
*Recommend:* **Rule stands for member-facing turns until J5 exists;** model independence is admitted only through the J5 seam with per-engine admission, not by tolerance of existing call sites.

**D-03 · One owner per truth.** Before any capability grant layer, will you rule a single owner for member consent and for member context?
*Recommend:* **Yes, rule ownership first;** candidate seed is the Writer `workReadScope` pattern for consent.

**D-04 · Governance custody.** The JARVIS Stewardship Constitution exists only on `chore/jarvis-stewardship-custody`; the Escalation Contract is in no commit. Should JARVIS treat them as governing?
*Recommend:* **Not until admitted to the default branch.** Until then this journey cites only the Instructional Manual v1 and ratified canon.

**D-05 · Claim discipline for the memos.** May memo language ("AIN OS governs the LLM", "Beyond Applications", five-element table) reach Heather's marketing architecture now?
*Recommend:* **Only with Live/Designed/Vision labels per §4,** and the Aether framing withheld until R3.

**D-06 · First act.** Open J3 (fidelity-instrument repair) as the next lane?
*Recommend:* **Yes** — under existing refusal-harness ownership, scoped to attributing and repairing the known reds, no re-baseline.

---

## 9 · Current act and exit

- **Current act:** present this journey to the founder. Nothing else.
- **Exit:** founder records D-01 … D-06 (any may be HOLD). On D-01 = Yes and explicit instruction, a pointer may be posted to #1910 and an index line to #1982.
- **This document authorizes nothing.** It changed no source, branch, PR, issue, worker, migration, member data or production state.
