# AgoraNet v3

A purpose-built civic commons: deliberation, decision-making, permanent
records, and provable collective action; one verified human, two
protected faces, an economy of assent instead of attention, and a
constitution that hands the platform to its community on a seven-year
schedule.

**Status:** Phases 0–8 (build half) checkpointed; **Phase 8.5
(Presentation Era) and Phase 8.6 (Testnet Rails) CLOSED by owner
ruling, 2026-07-15**; the platform runs its full showcase form on
real test-network rails. **The platform is live** at
https://www.agoranet.ai, with https://agoranet.ai redirecting to the
canonical `www` hostname. The Vercel deployment URL
https://agoranet-staging.vercel.app remains available for controlled
deployment checks, backed by Railway PostgreSQL. Migrations, seed,
invariant verification, and public smoke tests all passed on 2026-08-15.
The Phase 8 cohort checkpoint (a small real
cohort onboarding unaided on staging) remains open. Construction began 2026-07-10
against a complete ratified specification corpus. `CHECKPOINTS.md` is
the authoritative per-phase record (Phase 8.6's tx hashes, the
deployed contract address, and both owner demo runbooks live there);
`DECISIONS_PENDING.md` is the owner's queue.

- Specifications: see `CLAUDE.md` for the corpus location and build law.
- Construction sequence: BUILD_ORDER phases 0–9.
- Stack: Next.js · Prisma (SQLite dev · Postgres staging/production;
  dual schemas kept byte-identical by `db:validate:postgres`) ·
  **Cardano preprod and a Midnight testnet ZK contract, LIVE today**
  (a real demo token, a daily-anchored civic ledger, a real Identus
  credential issuer, a public zero-knowledge nullifier contract; all
  testnet, all disclosed as such; see `/transparency`) · real-money
  mechanics stay behind Phase 9's legal gate, untouched.
- Hosting: Vercel (the app and custom domains) + Railway (staging
  PostgreSQL; the ops jobs,
  including the daily chain anchor, remain the next operations slice).
- Operations: `docs/DEPLOYMENT.md` (staging setup),
  `docs/RUNBOOK.md` (backups, drills, the worst day),
  `docs/LOG_DISCIPLINE_AUDIT.md` (what is never logged, and why),
  `docs/OWNERS_GUIDE.md` (running, understanding, and explaining the
  platform to someone else; start here if that's your goal).

- Security and indexing: `/.well-known/security.txt` provides the private
  vulnerability-reporting contact, `SECURITY.md` describes the reporting
  policy, and `/robots.txt` keeps login, verification, settings, and search
  history routes out of routine crawler indexing.

## Getting started

```bash
cp .env.example .env       # then set a real GATE_OPERATOR_SECRET
npm install
npx prisma db push         # create prisma/dev.db
npm run db:seed            # seed the canon (7 pillars, 49 questions)
npm run db:verify          # the invariant check; run after any session
npm test                   # unit + integration tests
```

The local development database uses SQLite. The Postgres validation and
integration paths require a PostgreSQL `DATABASE_URL`; use the Postgres
schema and the deployment instructions in `docs/DEPLOYMENT.md` before
running `npm run db:verify:postgres` or the full Postgres test workflow.

## Checkpoint demos (owner review)

```bash
npm run demo:phase0        # Phase 0: gate-cleared events landing on the ledger, pseudonymously
npm run demo:tamper        # Phase 0: the invariant check failing loudly, twice
npm run demo:phase1        # Phase 1: post → badge → ledger → grace edit → LOCK → tamper caught → flag queued
npm run demo:phase2        # Phase 2: both ceremonies → parking rule → THE LINKAGE AUDIT → 11 checks
npm run demo:phase3        # Phase 3: governance poll end to end; seal, candle, sniper discarded, tamper caught
npm run demo:phase4        # Phase 4: grants → fees → tip → paid permanence → treasury fills → conservation
npm run demo:phase5        # Phase 5: a flag travels the whole road; blur → ruling → tombstone → appeal → tribunal
npm run demo:phase6        # Phase 6: Circle formed → action logged → attested → the public civic ledger
npm run demo:phase6.5      # Phase 6.5: request → bond → encrypted DMs → a report reaches the queue, graph unleaked
npm run demo:phase7        # Phase 7: domains live → Light Score derives → a Picture repaired by governance poll
npm run demo:phase7.5      # Phase 7.5: a chamber through the full scaffold; dual fees, enclosed workshop
npm run demo:phase8        # Phase 8: the walls, the counters that know nobody, the crush, the guard, 31 checks
```

All demos run against a self-contained `prisma/demo.db`; nothing touches
your dev database. The interactive version: `npm run dev`, then `/verify`
; the real onboarding: gate intro, interim issuer, True Self ceremony,
blocking consents, values seed, and back to what you came to do. Hatch
an Alias at `/alias` with your credential.

**The testnet chain rails** (Phase 8.6; optional, needs Docker and
the chain secrets in `.env`; the app runs fine without them, the
disclosures just stay honest about what's live):

```bash
cd infra/identus && docker compose up -d      # the Identus issuer
cd infra/midnight && docker compose up -d     # the ZK proof server
npx tsx scripts/chain/identus-loop.ts         # a full issue→hold→verify ceremony
cd infra/midnight && npm run exercise         # deploy/exercise the nullifier contract
npm run chain:anchor                          # anchor the ledger head to Cardano preprod
```

Full runbooks for the two owner-facing chain demos ("come try" and
"I lost everything" recovery) live in `CHECKPOINTS.md`, under Phase
8.6's close.

## What exists (Phase 8.5 & 8.6; the presentation era and the testnet rails)

- **Theme = identity** (`app/globals.css`, `app/layout.tsx`); three
  rooms keyed to the active face (reader blue / True Self white /
  Alias dark), never OS preference; the Agora dashboard IS the
  platform's home page; the blessed left nav, doors, and one-liners.
- **The Cardano rail** (`lib/chain.ts`, `lib/chainMint.ts`,
  `lib/chainAnchor.ts`, `scripts/chain/`); a per-face testnet wallet
  link (mainnet refused by construction), PollCoin Demo (dPOLL) minted
  under a throwaway preprod policy, and a railed daily anchor
  (`npm run chain:anchor`) witnessing the civic ledger's head hash in
  a public preprod transaction; `db:verify` check 27 keeps the
  witness and the record honest against each other.
- **The Identus issuer** (`infra/identus/`); a real, self-hosted W3C
  verifiable-credential issuer; the full issue→hold→verify ceremony
  runs end to end, and §1.5 recovery is proven: a returning human who
  re-proves who they are gets the SAME identity back, nothing
  orphaned.
- **The Midnight nullifier contract** (`infra/midnight/`); a Compact
  contract deployed to Midnight Preview enforcing the gate's
  one-per-scope law with zero-knowledge proofs, dev-grade and honestly
  disclosed as such: a spent nullifier is publicly auditable and
  linkable to no one; a duplicate is refused by the chain itself.
- **The honesty layer**; every disclosure upgraded ONLY where its
  trust claim became math (`lib/disclosures.ts`, `lib/gate.ts`); a
  live "what runs on real rails today" section on `/transparency`;
  the full Constitution and every written rule now readable on the
  platform at `/constitution` and `/rules`, linked from a real
  `/record` front door.

## What exists (Phases 6–8, in brief; CHECKPOINTS.md has the full record)

- **Circles** (`lib/circles.ts`, `/circles`); the action layer:
  formation, members' rooms (never the public record), resource
  boards, binding stewardship polls, and the attested action log on
  the civic ledger.
- **Fellow Souls & DMs** (`lib/fellowSouls.ts`, `lib/dm.ts`, `/souls`)
; mutual-consent bonds, structurally private graphs, encrypted
  threads (Phase A escrow, disclosed verbatim), recipient-side
  reporting into the unchanged moderation path.
- **Light Score & the dashboards** (`lib/lightScore.ts`, the hub,
  pillar and domain pages, `/transparency`, `/feed`, `/search`); 56
  domains as data, per-face per-pillar standing (never a sum), the
  Picture repair loop, the published feed formula, nine-entity search.
- **Chambers** (`lib/chambers.ts`, `/pollinator`); the idea
  incubator: public storefronts, enclosed workshops, dual-token fees.
- **Deployment hardening**; the Postgres track + parity discipline,
  backups with a self-proving restore drill, the consolidated
  rate-limit schedule (walls at machine speed; fees remain the real
  throttle), the minimal-log discipline (guarded by tests and
  `db:verify`), the privacy-constrained analytics funnel, and
  `/commons`; the State of the Commons.

## What exists (Phase 5)

- **Moderation Live** (`lib/moderation.ts`, `/moderation`); sortition
  badges (12h offers, 48h terms, cooldowns, pool scaling 5–200), the
  minimal case file behind the triangle of blindness, cite-a-rule
  fact-finding with auto-applied consequences (strike ladder, Gratium
  penalties, pillar-scoped Light Score deductions on a shared 6-month
  redemption clock), blur-don't-erase with the R3.1/R3.3 full-hide
  lane, heavy-tier 3-ruling majorities for permanent-space removals,
  new-moderator supervision + the self-visible Moderation Rating,
  deposit refund/forfeit, one appeal with fresh eyes, the restorative
  option, the interim Tribunal (badge-completers, treasury stipends),
  and Sentinel v1 (brigade bundling; machines point, humans rule).
  Every resolution is on the ledger, nullifier-keyed; tombstones cite
  the rule, forever.
- **Notifications** (`lib/notifications.ts`, `/inbox`); two tiers,
  per-persona inboxes, aggregation instead of storms, the quietest
  functional defaults. No streaks, no nags, ever. In-app is the launch
  channel; push is the ratified fast-follow.

## What exists (Phase 4)

- **The internal economy** (`lib/economy.ts`); per-profile PollCoin and
  Gratium balances (a soul's two faces never bridge), the treasury,
  and a double-entry money ledger: every balance re-derives from its
  entries, and `db:verify` fails loudly on any conservation break.
- **Every ratified fee, wired**; replies 2 PC with up to 1 PC participation
  accrual returned, votes 0.25 PC (ordinary
  = governance, per law), polls and Discussions 10 PC, paid permanence
  15 G, flag deposits 5 PC (never blocking at zero balance). The
  **Welcome Grant** funds the journey: 25+25 at verification, +10 at
  the values seed, +5 at orientation, +5 G at first action; a new
  Alias hatches with 10+10; born funded, not traceable-by-poverty.
- **Tips replace likes**; Gratium, 5% treasury cut; totals +
  unique-tipper breadth public, tipper identities never displayed. The
  sort menu gains **Most unique tippers** and **Most sourced**.
- **Attestation rails**; the "Human-made" mark, typed source tags
  resolving to shared source objects, vouched/unverified sharing by
  name. **`/treasury`** is the raw inspection window.

## What exists (Phase 3)

- **The Poll primitive** (`lib/polls.ts`); single/multi/consensus,
  Public and Pseudonymous modes (stated plainly before a soul votes),
  one vote per profile via the gate's per-poll nullifier, sealed-until-
  close by default (creator live-tally option on ordinary polls only).
  Pseudonymous ballots are nullifier-keyed; no profile attached, ever.
- **Governance rooms** (`/pillars/[slug]/governance`); one permanent
  room per pillar; governance polls are always sealed and close by
  candle: the true end is drawn randomly inside the final stretch,
  committed as a hash on the ledger before any vote exists, revealed
  verifiably with the results. Late ballots exist in the record,
  uncounted.
- **Records**; poll.created / poll.closed / vote.recorded (public
  mode, post-close only) on the hash-chained ledger, with recomputable
  tallies and a ballots hash; `db:verify` re-derives everything and
  fails loudly on any alteration. Consensus-fail offers (never forces)
  a Discussion; results export as JSON.

## What exists (Phase 2)

- **Onboarding** (`/verify`, `lib/identity.ts`); read-free/verify-to-act;
  the interim issuer hands over a credential (shown once, hash stored);
  True Self registration through the gate's per-human nullifier;
  permanence + Constitution acknowledgments (blocking, enforced at the
  first post); the seven-question values seed (skippable,
  matchmaking-only).
- **The Alias ceremony** (`/alias`); decoupled from any session, no
  public trace at registration, randomized cohort-batched activation,
  coarse join period, the §3.6 disclosures blocking at hatch. **An Alias
  row stores no humanId**; one-per-human is the registration nullifier,
  not a stored link; `db:verify` fails loudly if a linked Alias ever
  appears.
- **The parking rule** (`lib/parking.ts`); hard per-pillar session lock,
  blocked entry names the holding face, deliberate face-switch with a
  cooldown rail, persistent per-face profile indicator (violet ◆ True
  Self / teal ◇ Alias).
- **Phase A disclosures verbatim** (`lib/disclosures.ts`); every
  load-bearing disclosure mapped to its named moment in the flow.

## What exists (Phase 1)

- **Discussions core** (`lib/discussions.ts`, `app/`); the 49 canonical
  questions as permanent threaded spaces: read-only to the world,
  gate-cleared participation, the permanence badge at the door and in
  the composer, grace-window editing with visible history, and the lock.
  Locked records are hash-committed to the ledger; `db:verify` catches
  any silent alteration.
- **Labeled sort menu** (`app/pillars/[slug]`); every sort names what
  it measures; no hidden formula. The menu grows as its inputs arrive
  (unique tippers and sourced posts activate with Phase 4).
- **Flag capture** (`lib/flags.ts`); flags cite the rulebook (22 rules
  seeded as data), clear the gate in private recording mode (a flag's
  existence is never public; triangle of blindness), and queue for
  Phase 5's adjudicators.
- **Rails** (`lib/rails.ts`); every number as data with governance
  bounds; fee rails seeded, debits wire up with Phase 4's balances.

## What exists (Phase 0)

- **The Civic Ledger** (`lib/ledger.ts`); append-only, hash-chained from
  GENESIS, pseudonym-only. `npm run db:verify` re-verifies the whole chain
  and scans every event for internal ids.
- **The gate** (`lib/gate.ts`); pending → proof → cleared, the one flow
  every gated action uses forever. Phase A: operator-trusted HMAC
  nullifier (honestly disclosed in-module); per-profile and per-human
  scopes both live from day one. No feature ever bypasses it.
- **The canon** (`lib/canon.ts`); 7 pillars × 7 lenses = 49 questions,
  seeded as data with every seeding on the ledger.

*The six pillars diagnose. The Agora equips. The community inherits.*
