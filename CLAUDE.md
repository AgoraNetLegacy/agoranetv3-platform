# AgoraNet v3 — Build Law

This repository builds AgoraNet v3. **The specification corpus is law;
this file tells every session where the law lives and how to build
under it.**

## The Corpus (read before building anything)

- **Spec corpus:** `/Users/shawn/Desktop/Agoranetv3/` — 22+ ratified
  documents. Start with `AGORANET_V3_MODULE_INVENTORY.md` (the master
  index) and `BUILD_ORDER.md` (the construction sequence, phases 0–9
  plus 6.5/7.5).
- **Deferred items registry:** `OPEN_ITEMS_CHECKLIST.md` (Desktop
  corpus) — Tracks 5/6 are build-time and post-launch items with named
  homes. Consult before inventing.
- **v2 reuse source:** `/Users/shawn/Documents/Claude/Projects/Agoranet/platform`
  — three declared reuses: the Light Score engine,
  `lib/canon.ts` (7 pillars + 49 questions as data), and the
  `db:verify` hash-chain ledger check pattern. Port deliberately;
  never import blindly.

## The Methodology (owner-ratified; non-negotiable)

1. **Build exactly what the specs say. Where they're silent, FLAG —
   never invent.** (Owner: "you just build like the specs say.")
2. **One slice, one checkpoint** (BUILD_ORDER Rule 1; owner-amended
   2026-07-11): every phase ends at a recorded checkpoint. Claude's
   verification gates advancement — tests, db:verify, the phase demo,
   a browser walkthrough, and a line-by-line spec-conformance pass,
   all green — with the evidence written to `CHECKPOINTS.md`. The
   owner reviews at his leisure ("if your tests pass, there's no need
   for me to test as well"); anything that genuinely needs HIS
   judgment is flagged to him explicitly — blocking decisions
   interrupt, non-blocking ones queue in `DECISIONS_PENDING.md`.
3. **No feature ever bypasses the gate interface** — even in Phase A
   when bypassing would be easy.
4. **SQLite alone until deployment is imminent** (DATABASE_SETUP.md);
   Postgres + parity checking arrive at Phase 8.
5. **Internal balances before chains.** The economy is database rows
   until Phase 9's legal gate.
6. **Honest disclosures ship with their features** (Phase A
   operator-trust language, permanence badges, correlation warnings).
7. **When a phase checkpoint passes owner review, update the phase
   pointers before starting the next phase:** the "Current Phase"
   section at the bottom of this file AND the CURRENT PHASE block in
   `/Users/shawn/Desktop/Agoranetv3/BUILD_KICKOFF_PROMPT.md` (+ regen
   its PDF). Every new session must land on the true current phase —
   a stale pointer is a build hazard.

## Vocabulary & Conventions

- Users are **souls**; friends are **fellow souls**; Alias succession
  is **hatching**. Product prose uses this vocabulary; legal terms of
  art may retain standard wording.
- All fee/reward amounts come from
  `Economics/ECONOMIC_STARTING_DEFAULTS.md` (testing defaults, in
  units where reply = 1u) — implement as configurable rails, never
  hardcoded constants.
- ⚠ v2's "chambers" (pillar containers) ≠ v3 **Chambers** (Pollinator
  pods). Never merge them.
- Every parameter is a rail: poll-adjustable within bounds. Build
  parameters as data, not literals.

## Current Phase

**Phase 6 — Circles (the action layer)** (see BUILD_ORDER.md and
`Circles/CIRCLES_SPEC.md`; Phases 0–5 checkpointed per CHECKPOINTS.md
— read it first). Deliberation becomes provable action: formation
(25u fee, thin founders), browse/filter discovery + transparent
values-alignment surfacing (Phase 2 seed data), join gate with Alias
small-community warnings, the members' room (Circle-scoped
Discussion), resource board (non-custodial pledges),
Circle-restricted Polls (Phase 3 machinery), and THE ACTION LOG with
attestation — logged → attested (2+) → ledger — plus permanence
badges and Light Score crediting (recorded for the Phase 7 engine,
like the Phase 5 deductions).

**Phase 6 checkpoint:** a Circle forms, deliberates in its room,
decides by restricted poll, logs an action, gets it attested by 2+
members, and the attested action lands on the public ledger —
Alias warnings shown at the join gate, values-alignment visible in
discovery.
