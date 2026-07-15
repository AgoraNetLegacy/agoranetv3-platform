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

**Phase 8.5 — The Presentation Era** (owner-ratified 2026-07-12; see
the BUILD_ORDER amendment of the same date). Phases 0–8(build-half)
are done — CHECKPOINTS.md has every record. The owner's ratified
plan: build the platform to its FULL showcase form before promotion,
learning, or the cohort test — first the presentation redesign
(8.5), then the testnet rails (8.6: Midnight/Lace ID identity on
testnet, demo-grade tokens on preprod — NO production money
mechanics; those stay behind Phase 9's legal gate, unchanged).

**BOTH GATES SATISFIED (owner ratifications, 2026-07-13):**
`Presentation/PRESENTATION_SPEC.md` ratified (all ⭐ calls closed —
names all kept, glyphs stay symbols, nav + one-liners blessed as
drafted; fonts ruled at kickoff: Fraunces + Inter, self-hosted) and
`Chain Integration/TESTNET_RAILS_SPEC.md` ratified with its scout
appendix's honesty edits (§7 rulings: presentation fully first · DM
custody holds at disclosed escrow until Phase 9 · test token =
PollCoin Demo / dPOLL).

**Phase 8.5 CLOSED — owner walkthrough passed 2026-07-14** ("good
enough for now. Both profiles work. Hatching works… begin the
preparation for our blockchain integration"). Seven slices;
CHECKPOINTS.md carries the record incl. his walkthrough findings and
the owner-directed onboarding-journey slice. Derived rule flagged:
DECISIONS_PENDING #21.

**CURRENT: Phase 8.6 — Testnet Rails** (spec ratified 2026-07-13;
scout appendix is the working truth). **Slices 1–2 DONE, self-verified
2026-07-15 — CHECKPOINTS.md has tx hashes and gotchas:** the Cardano
rail is LIVE (dPOLL minted on preprod, first civic-ledger anchor
on-chain, owner wallet connected per-face) and the Identus issuer is
LIVE (two pinned 2.2.0 agents in infra/identus, full issue→hold→verify
loop green, §1.5 recovery property PROVEN by nullifier re-derivation).
**Slice 3 DONE, self-verified 2026-07-15 — the Midnight nullifier
contract is LIVE on Preview** (contract + tx ids + hard-won version
gotchas in CHECKPOINTS.md; the ZK rail: infra/midnight — Compact
contract, pinned proof-server compose, standalone exercise package;
the faucet moment happened; every nullifier property proven
on-chain). **Slice 4 DONE, self-verified 2026-07-15 — the honesty
layer:** daily anchor cadence live (rail + idempotent chain:anchor
runner + verify check 27; first cadence anchor on preprod),
disclosures upgraded ONLY where trust became math (gate, interim
issuer incl. the W5 no-repeat-detection truth, credential-loss
warning, alias item — consent bumped phase-a-v2), /transparency
"what runs on real rails today" live, both §5 demos REHEARSED with
owner runbooks in CHECKPOINTS.md. **NEXT: the owner gives the two
demos cold — his §5 checkpoint closes Phase 8.6.** NO mainnet, no custody, no production anything
(§6.6). All chain secrets live ONLY in gitignored .env (Blockfrost
preprod key, throwaway mint mnemonic, TEST_POLLCOIN_POLICY_ID).
Testnet mode is ADDITIVE — the Phase A HMAC path stays, never deleted
(§6.1/§6.6). Restart the dev server after any `npm run check` (builds
corrupt a live dev server's chunks).

**Standing owner rules (2026-07-12):** no production, and no mention
of production, until the lawyer conversation concludes. The Phase 8
cohort checkpoint runs on the showcase build. Theme = identity
(white True Self / dark Alias / blue reader, card-flip switch) is
his ratified design vision — build it exactly.
