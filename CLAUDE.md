# AgoraNet v3; Build Law

This repository builds AgoraNet v3. **The committed repository documents are
the public source of truth for work contributed here.** This file tells each
session how to work under them.

## The Corpus (read before building anything)

- **Public project record:** start with `README.md`, `CHECKPOINTS.md`,
  `DECISIONS_PENDING.md`, `docs/`, and the Constitution rendered from
  `lib/constitutionContent.ts`.
- **Historical authoring material:** earlier private planning material is not
  required to build or review this repository. If a change depends on an
  uncommitted decision, document that decision in the repository before
  implementation.
- **Prior-art reuse:** reuse from earlier work must be explicitly documented,
  reviewed, and licensed for inclusion. Never import code blindly.

## The Methodology (owner-ratified; non-negotiable)

1. **Build exactly what the specs say. Where they're silent, FLAG;
   never invent.** (Owner: "you just build like the specs say.")
2. **One slice, one checkpoint** (BUILD_ORDER Rule 1; owner-amended
   2026-07-11): every phase ends at a recorded checkpoint. Claude's
   verification gates advancement; tests, db:verify, the phase demo,
   a browser walkthrough, and a line-by-line spec-conformance pass,
   all green; with the evidence written to `CHECKPOINTS.md`. The
   owner reviews at his leisure ("if your tests pass, there's no need
   for me to test as well"); anything that genuinely needs HIS
   judgment is flagged to him explicitly; blocking decisions
   interrupt, non-blocking ones queue in `DECISIONS_PENDING.md`.
3. **No feature ever bypasses the gate interface**; even in Phase A
   when bypassing would be easy.
4. **SQLite alone until deployment is imminent** (DATABASE_SETUP.md);
   Postgres + parity checking arrive at Phase 8.
5. **Beginner Credits plus an optional testnet wallet path.** Internal,
   valueless Credits remain the default so a new user can participate
   without learning crypto. A linked-wallet user may opt into fake
   testnet assets directly, and a Credit user may explicitly claim
   eligible Credits into their own testnet wallet. Wallet balance truth
   comes from the chain; the database keeps Credits, workflow,
   reconciliation, and indexed chain state. Mainnet and real value still
   wait behind Phase 9's legal gate. (Owner amendment 2026-08-23;
   `docs/WALLET_CANONICAL_TOKEN_RAIL_SPEC.md`.)
6. **Honest disclosures ship with their features** (Phase A
   operator-trust language, permanence badges, correlation warnings).
7. **When a phase checkpoint passes review, update the committed phase
   pointers before starting the next phase.** Every new session must land on
   the true current phase; a stale pointer is a build hazard.

## Vocabulary & Conventions

- Users are **souls**; friends are **fellow souls**; Alias succession
  is **hatching**. Product prose uses this vocabulary; legal terms of
  art may retain standard wording.
- All fee/reward amounts come from
  `Economics/ECONOMIC_STARTING_DEFAULTS.md` (testing defaults, in
  units where reply = 1u); implement as configurable rails, never
  hardcoded constants.
- ⚠ v2's "chambers" (pillar containers) ≠ v3 **Chambers** (Pollinator
  pods). Never merge them.
- Every parameter is a rail: poll-adjustable within bounds. Build
  parameters as data, not literals.

## Current Phase

**Phase 8.5; The Presentation Era** (owner-ratified 2026-07-12; see
the BUILD_ORDER amendment of the same date). Phases 0–8(build-half)
are done; CHECKPOINTS.md has every record. The owner's ratified
plan: build the platform to its FULL showcase form before promotion,
learning, or the cohort test; first the presentation redesign
(8.5), then the testnet rails (8.6: Midnight/Lace ID identity on
testnet, demo-grade tokens on preprod; NO production money
mechanics; those stay behind Phase 9's legal gate, unchanged).

**BOTH GATES SATISFIED (owner ratifications, 2026-07-13):**
`Presentation/PRESENTATION_SPEC.md` ratified (all ⭐ calls closed;
names all kept, glyphs stay symbols, nav + one-liners blessed as
drafted; fonts ruled at kickoff: Fraunces + Inter, self-hosted) and
`Chain Integration/TESTNET_RAILS_SPEC.md` ratified with its scout
appendix's honesty edits (§7 rulings: presentation fully first · DM
custody holds at disclosed escrow until Phase 9 · test token =
PollCoin Demo / dPOLL).

**Phase 8.5 CLOSED; owner walkthrough passed 2026-07-14** ("good
enough for now. Both profiles work. Hatching works… begin the
preparation for our blockchain integration"). Seven slices;
CHECKPOINTS.md carries the record incl. his walkthrough findings and
the owner-directed onboarding-journey slice. Derived rule flagged:
DECISIONS_PENDING #21.

**★ PHASE 8.6 CLOSED; owner ruling 2026-07-15 ("this was great.
8.6 is done."), given the same day he performed BOTH §5 demos from
his own terminal.** All four slices done; CHECKPOINTS.md carries the
complete record: tx hashes, the deployed Midnight nullifier contract,
SDK version gotchas, his walkthrough findings (all fixed
same-session: /constitution + /rules public pages, de-jargoned
version-aware consents, self-explaining secret screens with Download,
the un-hidden values seed), and THE TWO OWNER DEMO RUNBOOKS; read
those before touching chain code. LIVE on real test rails: dPOLL on
preprod, the daily anchor cadence (chain:anchor, rail-governed,
verify check 27), the Identus issuer with §1.5 recovery proven, the
Midnight nullifier contract enforcing one-per-scope by ZK proof.

**★ PHASE 8.7 CLOSED; the owner's ratification read AND his demo run
(his own terminal) both landed 2026-07-19; the run's record is
witnessed by preprod anchor 6f850037…. Rulings #17/#18/#19 were
resolved 2026-07-16 (see DECISIONS_PENDING). The ON-CHAIN ECONOMY
MIGRATION (parallel track, owner-scheduled) also completed Tracks 1+2
on 2026-07-18/19; see CHECKPOINTS.md's chain entries and the corpus
ONCHAIN_* docs.** Original build record:
BUILD-HALF COMPLETE (2026-07-16). He scheduled it the same
day he said "I am done building," on his own argument: Fund Integrity's
components ALL already run, so a working demo proves *integration*; the
real moat; better than presentation polish would. Seven slices, all
self-verified; CHECKPOINTS.md carries the record and **THE OWNER'S
RUNBOOK** (`npm run demo:phase8.7`, ten steps, ~15s, ends on a real
preprod anchor tx). Specs: `Fund Integrity/` (PHASE_8_7_SPEC +
FUND_INTEGRITY_SPEC + COMMUNITY_ENDOWMENT_SPEC). Internal points only;
**no legal gate** (§9.1: "No legal gate applies").

What it built: budget categories + `payFromTreasury` (**a constitutional
guardrail made true for the first time**; the category rule had NO code
behind it; the new db:verify check caught a 4th outflow the audit missed),
source-agnostic escrow with automatic release/freeze (no operator step
exists; the guarantee is the ABSENCE of the path), §9.1 donations and
its binding-vote second door, Tier 0's funding plan, and Fund Auditors
(paid per case, NEVER per finding).

**Owner rulings that shaped it:** recipients are **CHAMBERS, never
Circles** (Principle 4 forbids Circle custody; §9.1 already gives
Chambers a balance; so his ruling avoided a spec amendment rather than
needing one); **the Tournament IS the formula** for discretionary
funding; the endowment is spec-only, gated on Legal #10.

**All three rulings landed 2026-07-16:** #17 freeze trigger = R3.4
fraud only, accused is the proposer (RESOLVED AND BUILT); #18 donation
inferences and #19 auditor numbers RATIFIED AS BUILT. Nothing from 8.7
awaits the owner.

**CURRENT: the owner's LEARNING ERA.** The platform is in its full
testnet showcase form. No build phase is active; the owner schedules
all further build work; sessions never self-start it. Remaining on
the shelf: the deployment slice (Vercel+Railway, #14; prerequisite
for the Phase 8 cohort checkpoint, the one phase-half still open),
five fully-spec'd queued slices (DECISIONS_PENDING #19, #2, #3, #4,
#17), and Phase 9 behind the legal gate. During learning: answer
from the ratified record, walk him through the real platform, fix
what his eyes find; one slice, one checkpoint still governs any
code change. NO mainnet, no custody, no production anything (§6.6);
no production TALK until the lawyer conversation concludes. All
chain secrets live ONLY in gitignored .env. Testnet mode is ADDITIVE
; the Phase A HMAC path stays, never deleted (§6.1/§6.6). Restart
the dev server after any `npm run check` (builds corrupt a live dev
server's chunks).

**Standing owner rules (2026-07-12):** no production, and no mention
of production, until the lawyer conversation concludes. The Phase 8
cohort checkpoint runs on the showcase build. Theme = identity
(white True Self / dark Alias / blue reader, card-flip switch) is
his ratified design vision; build it exactly.
