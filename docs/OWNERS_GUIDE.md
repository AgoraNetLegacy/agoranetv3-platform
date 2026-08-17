# The Owner's Guide; running, understanding, and explaining AgoraNet

Written for Shawn, 2026-07-11, the day the Phase 8 build finished.
**Updated 2026-07-15, the day Phase 8.6 closed**; the blockchain
threshold that ended v1 and v2 fell, on real (test) rails, and this
guide's central claims about what's "real vs. simulated" needed to
change with it (§2). This is the manual for three jobs: **run it on
your machine, walk it as a user, and explain it to someone else.** No
jargon without a definition; no step without its full command.

---

## 1. What you built (the two-minute version, for telling humans)

AgoraNet is a civic commons; a place where verified humans deliberate,
decide, and prove they acted. Five sentences you can say to anyone:

1. **Every account is one real human**; verified once at the door, so
   there are no bots and no sock puppets, but the platform never sees
   your identity documents.
2. **Every human gets two identities:** a True Self for what you'll sign
   publicly, and an Alias for the argument you can't afford
   professionally; and no record anywhere links the two.
3. **Reading is free; acting costs a little**; tiny fees instead of
   ads or data harvesting, so the platform's money comes from
   participation, not surveillance. Money never buys outcome weight.
4. **What the community decides becomes permanent record**; votes are
   sealed and tamper-evident, records are hash-chained, and anyone can
   verify nothing was quietly rewritten.
5. **Talk becomes proof:** Circles log real-world actions that other
   verified humans co-sign, so "we discussed it" can become "here's
   the receipt that we did it."

The seven pillars (Compassion, Hope, Justice, Freedom, Unity, Harmony,
The Agora) are the map; 49 canonical questions plus 56 domains are the
territory. *The six examine the forces that hold us back. The Agora equips
us to act. The community inherits.*

## 2. What's real and what's simulated (say this honestly, always)

**This table changed shape on 2026-07-15.** It used to be two
columns; today's honest stand-in, and Phase 9's someday-real thing.
Phase 8.6 added a real middle state: three of the "someday" rows are
no longer someday. They are live, on public test networks, with
transaction hashes anyone can check; just not yet wired into the
LIVE gate every soul actually uses.

| Layer | The live gate (Phase A, what every soul uses today) | Proven on testnet (Phase 8.6, real but not yet load-bearing) | Real money (Phase 9, behind the legal gate) |
|---|---|---|---|
| Identity verification | The platform itself plays the issuer; instant, honest stand-in | A real, self-hosted Identus issuer runs the full issue→hold→verify ceremony; §1.5 recovery proven (lose everything, re-prove who you are, get the SAME identity back) | Lace ID when it ships; independent of any platform-operated issuer |
| Unlinkability of your two identities | Operator policy; no database row links them, and we prove it, but you're trusting us | A public Midnight contract enforces the SAME one-per-scope law with zero-knowledge proofs today; dev-grade proving (20–60s), but the math is real and checkable by anyone | The live gate itself cuts over once proving is consumer-ready |
| PollCoin & Gratium | Internal balances; database rows with real double-entry accounting | PollCoin Demo (dPOLL); a real (test) Cardano asset, minted under a throwaway preprod policy, verifiable on a public explorer | Real Cardano assets with deposit/withdraw |
| The civic ledger's integrity | Hash-chained, `db:verify` re-checks it locally | Anchored daily to a public Cardano preprod transaction; rewriting history now means contradicting a public blockchain's own timestamps, not just our say-so | Same mechanism; real network |
| Wallet | A credential string you save like a password | A Lace preprod connection exists (`/settings`, per identity, mainnet refused by construction) | Lace wallet connection, real network |
| DM encryption | Real encryption; keys held by the operator in escrow | Unchanged; DM custody holds at disclosed escrow through 8.6 by owner ruling, re-evaluated after the issuer loop proved out | Keys move to your wallet; we structurally *can't* read |

**The critical point for teaching and selling:** none of this is
hidden. Every layer, at every stage, is disclosed *in the product, at
the exact moment it matters*; `/transparency`'s own "what runs on
real rails today" section says exactly this, in the same three-state
shape, with live links to the token, the latest anchor, and the
deployed contract. The trust model isn't a limitation to apologize
for; the honesty IS the product's signature, and now it has
receipts. You are not selling fake crypto; you are selling a platform
so honest it labels its own scaffolding, and can already prove the
parts that stopped being scaffolding.

## 3. Running it on your machine

Everything happens in the platform repo. The `agora` alias takes you
there, or the full path:

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run dev
```

Open **http://localhost:3000**. That's it; the `.env` file on your
machine already holds the dev secrets and points at the local dev
database (`prisma/dev.db`, a single file; that's SQLite; staging and
production use Postgres, but locally one file is the whole database).

**Want a completely fresh platform** (recommended before your first
real walkthrough; empty of test data, exactly what a stranger would
see):

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npx prisma db push --force-reset   # wipe the local database
npm run db:seed                    # reseed: pillars, questions, domains, rails, rules
npm run dev
```

The seed IS the launch content: 7 pillars, 49 canonical questions, 56
domains with their Pictures, 22 moderation rules, and every economic
number as an adjustable rail. A fresh AgoraNet is never empty.

**After any session, the health check** (this re-verifies the entire
hash-chained ledger and 31 platform invariants; the "nothing was
quietly broken" button):

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run db:verify
```

## 4. Your first session; the guided walkthrough (~30 minutes)

Do this once slowly, noticing the labeled things. It's the same tour
you'll later give a cohort member, an investor, or Charles Hoskinson.

**A. Arrive as a stranger (2 min).** Open http://localhost:3000 in a
regular window. Click into a pillar, open a canonical question, read.
Notice: *you needed no account for any of this.* Reading is free by
constitutional design.

**B. Meet the gate (3 min).** Click "verify to act." Read the two
notices; this is the platform being honest about Phase A (operator
trust, interim issuer). Click **Begin verification**. You'll receive
your **Humanity Credential**; a long string shown exactly once.
**Save it somewhere real** (password manager). This is your "wallet"
until Lace arrives.

**C. Become a True Self (5 min).** Enter the credential, pick a
display name (anything, even your real name) and an @handle
(permanent, yours forever). Save the **access key** you're shown;
that’s how this identity signs in. Then the two consents: read them, they
are load-bearing; permanence means *your words in permanent spaces
outlive your account*. Then orientation, then the values seed (answer
a couple honestly; they feed Circle matchmaking someday, and are
never public).

**Notice the header:** your balances appeared; 30.00 PC · 25.00 G.
Nobody gave you crypto; the Welcome Grant funded your journey as you
took each step. That's the economy working.

**D. Speak into the permanent record (5 min).** Enter a pillar (notice
it "parks" your identity; one identity per pillar at a time, the timing
protection). Open a canonical question. Notice the amber banner;
*you are standing in a permanent space*; and that the post button
itself names its price: "· 2 PC". Post something real. Watch your
balance drop by 2; participation accrual can return 1 PC when the
daily and weekly ceilings allow, so genuine participation has a net
cost of 1 PC while still earning something back.
Try **Edit**; you have a 15-minute grace window, with visible
history, then your words lock forever.

**E. See the machinery see you (5 min).** Open three pages:
- **/ledger**; find your post's hash-commitment. Pseudonyms only.
- **/transparency**; your 2 PC fee is in the books. Where money
  comes from and goes is public, forever.
- **/commons**; the funnel counted your journey (arrival → verified →
  registered → consents → seed → oriented) as bare numbers. No
  profile of you exists; the platform measured its *product*, not
  its person. That's the analytics story you can defend anywhere.

**F. Hatch your Alias (5 min).** Go to **/alias**. Read the early-
platform honesty note (small crowd = thin anonymity; the platform
refuses to oversell privacy) and the seven disclosures; this screen
is the heart of the dual-identity promise. Hatch with your credential:
*different* name, *different* handle. It is available immediately, but
starts private. Sign in with the Alias key, then deliberately make it
visible when you are ready. Notice: separate balances, separate
standing, separate everything. Two identities, one human, zero stored
links.

**G. The rest of the estate (5 min, skim).** **/circles** (form one;
watch the 25 PC fee; log an action; it needs a second soul to attest,
which is the point), **/pollinator** (open a chamber through the
scaffold; the dual-token fee, both balances drop), a **governance
room** inside any pillar (open a poll; votes are sealed until a
randomized "candle" close that was hash-committed before the first
vote existed), **/feed** (the formula is published at /feed/formula;
no hidden algorithm exists to accuse), **/profile** (your standing
per pillar; never one number, by constitutional law).

**H. Prove it's honest (2 min).** Back in the terminal:

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run db:verify        # all 31 checks against everything you just did
npm run demo:tamper      # watch verification FAIL LOUDLY on forged history
```

That second command is the best sales demo in the repo: it forges the
ledger and shows the platform catching itself.

**I. Touch the real chain (new, 2026-07-15; the actual capstone now).**
Everything above proves the platform is honest with itself. This step
proves it to a stranger, on infrastructure neither of you controls.
Open `/transparency` and scroll to **"What runs on real rails
today"**; click through to the token and the latest anchor on a
public Cardano explorer. If the chain services are running locally
(`docker compose up -d` in `infra/identus` and `infra/midnight`), the
two full runbooks in `CHECKPOINTS.md` under Phase 8.6's close walk you
through giving this cold: a zero-knowledge spend clearing and a
duplicate being refused by the chain itself, and a soul who "lost
everything" getting their exact same identity back through a real
credential re-proof. This is the walking demo you can give a stranger,
an investor, or Charles Hoskinson, with transaction hashes they can
verify themselves after you've left the room.

## 5. The demo scripts (each phase's story, self-running)

Each one builds a throwaway database and narrates one subsystem end to
end; they never touch your dev data. Run any of them when you want to
re-learn a subsystem:

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run demo:phase0    # the ledger + the gate (the foundation of trust)
npm run demo:phase1    # permanent Discussions, grace windows, locking
npm run demo:phase2    # two identities, zero links; the linkage audit
npm run demo:phase3    # sealed polls, the candle close, tamper-evidence
npm run demo:phase4    # the economy: grants, fees, tips, conservation
npm run demo:phase5    # a flag's full journey through moderation
npm run demo:phase6    # a Circle logs an action; co-signers attest it
npm run demo:phase6.5  # bonds + encrypted DMs + a report, graph unleaked
npm run demo:phase7    # Light Score derives; a Picture gets repaired
npm run demo:phase7.5  # a chamber: public storefront, enclosed workshop
npm run demo:phase8    # the walls, the counters, the crush, the guard
```

## 6. How to explain the money (the question everyone asks)

- **Two currencies:** PollCoin (the doing token; fees, creation,
  staking someday) and Gratium (the appreciation token; tips, paid
  permanence). Both earned by participating; both granted at welcome.
- **Everything is a fee OR a grant, and both are tiny.** A reply costs
  1 PC (~6–8 cents at the calibration target). Every fee goes to the
  treasury; every treasury flow is public at /transparency.
- **Money never buys outcomes.** Fees gate the *doing*, never the
  result. No paid visibility, no promoted posts; permanently
  prohibited.
- **All numbers are "rails"**; adjustable settings with bounds, not
  hardcoded; and the entire schedule is a TEST schedule that expires
  when real money arrives at Phase 9 with fresh review.
- **"Is this a crypto project?"** The honest 2026-07-15 answer, not
  the old one: on the live gate every soul uses today, no; the
  tokens are honest internal points. But on testnet, yes, already;
  PollCoin Demo is a real Cardano asset, a real Identus issuer runs
  the identity ceremony, and a real zero-knowledge contract enforces
  the gate's core promise on a public network. At Phase 9, behind
  lawyers, that testnet proof becomes the live gate's real rail. The
  product works identically at every stage; that was the point of
  building the gate as an interface.

## 7. What is deliberately NOT here yet

- **Corrected 2026-07-15:** Cardano assets, an Identus identity
  ceremony, and a ZK-proof contract are NOT future items anymore;
  they are live on testnet, proven, with the two demo runbooks in
  `CHECKPOINTS.md` to show them cold. What's genuinely still ahead:
  **real money, at Phase 9**; mainnet, real PollCoin, real custody,
  a licensed identity partner replacing the platform-operated
  Identus issuer, Lace ID when it ships, the live gate actually
  cutting over to the proven testnet math. All gated on the KYC/legal
  conversation; item #1 in DECISIONS_PENDING.
- **Post-launch by decision:** the Tournament of Ideas, Keystone
  stones, push notifications, AI summaries, group DMs, invite
  mechanics (your call), support-staking UI, and (new, 2026-07-15) the
  Inner Citadel; your own idea, fully specced and deliberately
  parked (`Inner Citadel/INNER_CITADEL_SPEC.md` in the Desktop corpus).
- **A mobile app**; ratified target, unscheduled; the web app is
  responsive in the meantime.

## 8. Where everything lives

| Thing | Place |
|---|---|
| The code | `~/Documents/Claude/Projects/Agoranetv3/platform` (GitHub: projectpollify/agoranetv3-platform) |
| The specs (LAW) | `~/Desktop/Agoranetv3/` |
| What shipped, phase by phase | `CHECKPOINTS.md` in the repo; the receipts |
| Your queue | `DECISIONS_PENDING.md`; section A is the only "now" |
| Every derived number's justification | `DERIVED_DEFAULTS.md` |
| Deployment (Vercel + Railway, both accounts already yours) | `docs/DEPLOYMENT.md` |
| Disaster manual | `docs/RUNBOOK.md` |
| Privacy audit (what is never logged) | `docs/LOG_DISCIPLINE_AUDIT.md` |
| This guide | `docs/OWNERS_GUIDE.md` (+ PDF beside the specs) |

**The pitch, in one line, when someone asks what you made:** *"A
governance platform honest enough to label its own scaffolding; one
human, one voice, two protected identities, permanent records anyone can
verify, and an economy that charges pennies for participation instead
of harvesting attention."*
