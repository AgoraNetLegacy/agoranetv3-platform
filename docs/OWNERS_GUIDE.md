# The Owner's Guide — running, understanding, and explaining AgoraNet

Written for Shawn, 2026-07-11, the day the build finished. This is the
manual for three jobs: **run it on your machine, walk it as a user,
and explain it to someone else.** No jargon without a definition; no
step without its full command.

---

## 1. What you built (the two-minute version, for telling humans)

AgoraNet is a civic commons — a place where verified humans deliberate,
decide, and prove they acted. Five sentences you can say to anyone:

1. **Every account is one real human** — verified once at the door, so
   there are no bots and no sock puppets, but the platform never sees
   your identity documents.
2. **Every human gets two faces:** a True Self for what you'll sign
   publicly, and an Alias for the argument you can't afford
   professionally — and no record anywhere links the two.
3. **Reading is free; acting costs a little** — tiny fees instead of
   ads or data harvesting, so the platform's money comes from
   participation, not surveillance. Money never buys outcome weight.
4. **What the community decides becomes permanent record** — votes are
   sealed and tamper-evident, records are hash-chained, and anyone can
   verify nothing was quietly rewritten.
5. **Talk becomes proof:** Circles log real-world actions that other
   verified humans co-sign, so "we discussed it" can become "here's
   the receipt that we did it."

The seven pillars (Compassion, Hope, Justice, Freedom, Unity, Harmony,
The Agora) are the map; 49 canonical questions plus 56 domains are the
territory. *The six diagnose. The Agora equips. The community inherits.*

## 2. What's real and what's simulated (say this honestly, always)

| Layer | Today (Phase A) | Later (Phase 9, behind the legal gate) |
|---|---|---|
| Identity verification | The platform itself plays the issuer — instant, honest stand-in | Lace ID / Midnight: an independent issuer, cryptographic proof |
| Unlinkability of your two faces | Operator policy — no database row links them, and we prove it, but you're trusting us | Zero-knowledge math — trusting no one |
| PollCoin & Gratium | Internal balances — database rows with real double-entry accounting | Real Cardano assets with deposit/withdraw |
| Wallet | A credential string you save like a password | Lace wallet connection |
| DM encryption | Real encryption; keys held by the operator in escrow | Keys move to your wallet — we structurally *can't* read |

**The critical point for teaching and selling:** none of this is
hidden. Every simulated layer is disclosed *in the product, at the
exact moment it matters* — the gate says "you are trusting us, not
yet math"; the DM screen says "keys are in escrow"; the Alias ceremony
says "this is operator policy on a published path to cryptography."
The trust model isn't a limitation to apologize for — the honesty IS
the product's signature. You are not selling fake crypto; you are
selling a platform so honest it labels its own scaffolding.

## 3. Running it on your machine

Everything happens in the platform repo. The `agora` alias takes you
there, or the full path:

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run dev
```

Open **http://localhost:3000**. That's it — the `.env` file on your
machine already holds the dev secrets and points at the local dev
database (`prisma/dev.db`, a single file — that's SQLite; staging and
production use Postgres, but locally one file is the whole database).

**Want a completely fresh platform** (recommended before your first
real walkthrough — empty of test data, exactly what a stranger would
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
hash-chained ledger and 31 platform invariants — the "nothing was
quietly broken" button):

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run db:verify
```

## 4. Your first session — the guided walkthrough (~30 minutes)

Do this once slowly, noticing the labeled things. It's the same tour
you'll later give a cohort member, an investor, or Charles Hoskinson.

**A. Arrive as a stranger (2 min).** Open http://localhost:3000 in a
regular window. Click into a pillar, open a canonical question, read.
Notice: *you needed no account for any of this.* Reading is free by
constitutional design.

**B. Meet the gate (3 min).** Click "verify to act." Read the two
notices — this is the platform being honest about Phase A (operator
trust, interim issuer). Click **Begin verification**. You'll receive
your **Humanity Credential** — a long string shown exactly once.
**Save it somewhere real** (password manager). This is your "wallet"
until Lace arrives.

**C. Become a True Self (5 min).** Enter the credential, pick a
display name (anything, even your real name) and an @handle
(permanent, yours forever). Save the **access key** you're shown —
that's how this face signs in. Then the two consents: read them, they
are load-bearing — permanence means *your words in permanent spaces
outlive your account*. Then orientation, then the values seed (answer
a couple honestly — they feed Circle matchmaking someday, and are
never public).

**Notice the header:** your balances appeared — 30.00 PC · 25.00 G.
Nobody gave you crypto; the Welcome Grant funded your journey as you
took each step. That's the economy working.

**D. Speak into the permanent record (5 min).** Enter a pillar (notice
it "parks" your face — one face per pillar at a time, the timing
protection). Open a canonical question. Notice the amber banner —
*you are standing in a permanent space* — and that the post button
itself names its price: "· 1 PC". Post something real. Watch your
balance drop by 1... and check it again in a minute (participation
accrual quietly gives it back — genuine participation is net-free).
Try **Edit** — you have a 15-minute grace window, with visible
history, then your words lock forever.

**E. See the machinery see you (5 min).** Open three pages:
- **/ledger** — find your post's hash-commitment. Pseudonyms only.
- **/transparency** — your 1 PC fee is in the books. Where money
  comes from and goes is public, forever.
- **/commons** — the funnel counted your journey (arrival → verified →
  registered → consents → seed → oriented) as bare numbers. No
  profile of you exists — the platform measured its *product*, not
  its person. That's the analytics story you can defend anywhere.

**F. Hatch your Alias (5 min).** Go to **/alias**. Read the early-
platform honesty note (small crowd = thin anonymity — the platform
refuses to oversell privacy) and the seven disclosures — this screen
is the heart of the dual-identity promise. Hatch with your credential:
*different* name, *different* handle. Notice it activates on a delay,
at a random moment in a cohort — a timing protection, explained right
there. Sign in with the Alias key when it activates and notice: separate
balances, separate standing, separate everything. Two voices, one
human, zero stored links.

**G. The rest of the estate (5 min, skim).** **/circles** (form one —
watch the 25 PC fee; log an action; it needs a second soul to attest,
which is the point), **/pollinator** (open a chamber through the
scaffold — the dual-token fee, both balances drop), a **governance
room** inside any pillar (open a poll; votes are sealed until a
randomized "candle" close that was hash-committed before the first
vote existed), **/feed** (the formula is published at /feed/formula —
no hidden algorithm exists to accuse), **/profile** (your standing
per pillar — never one number, by constitutional law).

**H. Prove it's honest (2 min).** Back in the terminal:

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run db:verify        # all 31 checks against everything you just did
npm run demo:tamper      # watch verification FAIL LOUDLY on forged history
```

That second command is the best sales demo in the repo: it forges the
ledger and shows the platform catching itself.

## 5. The demo scripts (each phase's story, self-running)

Each one builds a throwaway database and narrates one subsystem end to
end — they never touch your dev data. Run any of them when you want to
re-learn a subsystem:

```bash
cd ~/Documents/Claude/Projects/Agoranetv3/platform
npm run demo:phase0    # the ledger + the gate (the foundation of trust)
npm run demo:phase1    # permanent Discussions, grace windows, locking
npm run demo:phase2    # two faces, zero links — the linkage audit
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

- **Two currencies:** PollCoin (the doing token — fees, creation,
  staking someday) and Gratium (the appreciation token — tips, paid
  permanence). Both earned by participating; both granted at welcome.
- **Everything is a fee OR a grant, and both are tiny.** A reply costs
  1 PC (~6–8 cents at the calibration target). Every fee goes to the
  treasury; every treasury flow is public at /transparency.
- **Money never buys outcomes.** Fees gate the *doing*, never the
  result. No paid visibility, no promoted posts — permanently
  prohibited.
- **All numbers are "rails"** — adjustable settings with bounds, not
  hardcoded — and the entire schedule is a TEST schedule that expires
  when real money arrives at Phase 9 with fresh review.
- **"Is this a crypto project?"** Today, no — the tokens are honest
  internal points. At Phase 9, behind lawyers, PollCoin becomes a
  Cardano asset and identity moves to Midnight. The product works
  identically either way — that was the point of building the gate
  as an interface.

## 7. What is deliberately NOT here yet

- **Phase 9 (everything blockchain):** Cardano assets, Midnight
  identity, Lace wallet, ZK proofs, Arweave anchoring. Gated on the
  KYC/legal conversation — item #1 in DECISIONS_PENDING.
- **Post-launch by decision:** the Tournament of Ideas, Keystone
  stones, push notifications, AI summaries, group DMs, invite
  mechanics (your call), support-staking UI (the one launch-spec
  feature not yet built — say when).
- **A mobile app** — ratified target, unscheduled; the web app is
  responsive in the meantime.

## 8. Where everything lives

| Thing | Place |
|---|---|
| The code | `~/Documents/Claude/Projects/Agoranetv3/platform` (GitHub: projectpollify/agoranetv3-platform) |
| The specs (LAW) | `~/Desktop/Agoranetv3/` |
| What shipped, phase by phase | `CHECKPOINTS.md` in the repo — the receipts |
| Your queue | `DECISIONS_PENDING.md` — section A is the only "now" |
| Every derived number's justification | `DERIVED_DEFAULTS.md` |
| Deployment (when you make the Render account) | `docs/DEPLOYMENT.md` |
| Disaster manual | `docs/RUNBOOK.md` |
| Privacy audit (what is never logged) | `docs/LOG_DISCIPLINE_AUDIT.md` |
| This guide | `docs/OWNERS_GUIDE.md` (+ PDF beside the specs) |

**The pitch, in one line, when someone asks what you made:** *"A
governance platform honest enough to label its own scaffolding — one
human, one voice, two protected faces, permanent records anyone can
verify, and an economy that charges pennies for participation instead
of harvesting attention."*
