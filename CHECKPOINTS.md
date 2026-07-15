# Checkpoint Record

Per the owner-amended methodology (2026-07-11): Claude's verification
gates phase advancement — tests, `db:verify`, the phase demo, a browser
walkthrough, and a spec-conformance pass, all green — and every
checkpoint is recorded here. The owner reviews at his leisure; anything
needing his judgment specifically is flagged to him directly
(blocking) or queued in `DECISIONS_PENDING.md` (non-blocking).

Each entry: what shipped · the evidence · what the owner would judge
if he chose to look.

---

## Phase 0 — Foundation ✅ OWNER-RATIFIED (2026-07-10)

Ledger (append-only, hash-chained, pseudonym-only) · gate
(pending→proof→cleared, Phase A HMAC, per-profile + per-human scopes) ·
canon seed (7×7=49). Evidence: `demo:phase0`, `demo:tamper`, 21 tests.

## Phase 1 — Discussions Core ✅ OWNER-RATIFIED (2026-07-10)

49 canonical permanent threads · gated posting · grace-window edit +
lock (hash-committed; silent edits caught) · labeled sort menu · flag
capture (queue-only, private). Evidence: `demo:phase1`, 32 tests.

## Phase 2 — Dual Identity Complete ✅ OWNER-RATIFIED (2026-07-10)

Onboarding Stages 1–6 · Alias ceremony with every timing mitigation ·
NO stored link between faces (Alias has no humanId) · parking rule ·
Phase A disclosures verbatim · two-layer naming amendment (display
name + eternal @handle, tombstoned never recycled). Evidence:
`demo:phase2` (the linkage audit: 0 co-occurrence rows), 48 tests.

## Phase 3 — Polls & Governance Rooms ✅ OWNER-RATIFIED (2026-07-10)

Poll primitive (single/multi/consensus, Public/Pseudonymous, sealed
default) · governance rooms, always-sealed + candle close (committed
pre-vote, revealed verifiably) · records that re-derive. Evidence:
`demo:phase3`, 55 tests, live browser run.

## Phase 4 — The Internal Economy ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** per-profile PC/G balances (faces never bridge) · treasury ·
double-entry money ledger · every ratified fee wired (reply, vote,
poll, discussion, paid permanence, flag deposit — never blocking at
zero) · Welcome Grant (verification/seed/orientation/first-action/
hatch) · tips (5% cut; breadth public, names never) · attestation
rails (human-made mark, source objects, vouched sharing) · sort menu
gained tippers + sourced · Participation Accrual v0 (owner-delegated
into this phase: ceilings 10/day + 50/week as rails, capped streak,
private weights) · `/treasury` raw inspection page.

**Evidence:** 68 tests across 8 files; `db:verify` 18 checks including
economy conservation (every balance re-derives from entries; inflating
a balance out of thin air fails loudly — demonstrated in
`demo:phase4`); browser walkthrough of balances, fee labels, tipping,
upgrade flow, and `/treasury` (screenshots in session record);
spec-conformance pass against TOKENOMICS_SPEC + ECONOMIC_STARTING_
DEFAULTS + DISCUSSIONS §4/§6/§8/§10.

**If you choose to look (15 min):** sign in → header shows your
balances → post (fee −1, accrual +1: net-free while genuine) → tip a
post (breadth shown, no names) → `/treasury` (aggregates only). Judge:
is this the economy of assent you ratified?

## Phase 5 — Moderation Live (+ Notifications) ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** the full judicial branch — badge lifecycle (sortition
offers, equip/pass, 48h hard cutoff, 7d cooldown, pool scaling),
minimal case files (triangle of blindness — verified no-leak in tests
AND live UI), cite-a-rule rulings, auto-applied strike ladder (Gratium
penalty clamped at zero, pillar-scoped LS deductions recorded for the
Phase 7 engine, rate-limit at 2, read-only + Tribunal review at 3),
blur-don't-erase + expedited full-hide (R3.1/R3.3 only), heavy-tier
3-ruling majorities, supervision with taper + Moderation Rating v0
(public inputs, secret weights, self-visible only), per-case-resolved
treasury rewards × rating multiplier (≤2×), deposit refund on upheld
AND good-faith declined / forfeit on bad-faith, one appeal to fresh
eyes (original rulers excluded) or the Tribunal, consequence reversal
+ deposit refund on successful appeal, the restorative option
(correction appended + hash-committed, strike reduced), interim
Tribunal from badge-completers (30d staggered, treasury stipends,
majority-of-seats), Sentinel v1 brigade bundling. Notifications: two
tiers, per-persona, aggregated; badge offers / rulings-to-both-parties
(anonymity-respecting) / poll-closing time-sensitive; tips + poll
results quiet.

**Evidence:** 79 tests across 9 files; db:verify grew to 20 checks
(moderation integrity: no moderator identity anywhere on the ledger,
every resolution on-ledger, tombstones cite real rules, no content
actioned without a case — off-process removal fails loudly, under
test); `demo:phase5` walks the checkpoint end to end; workbench +
inbox verified live in the browser (case file leaked no handles).

**Interim rules set at build time (flagged):** supervision cold-start
(when no qualified second moderator exists anywhere, rulings take
effect directly — mirrors BUILD_ORDER's interim-tribunal rule); strike
penalty amounts (2/5 uG) and LS deductions (5/10 × tier) are
build-time rails; Sentinel brigade threshold 5 flags/24h.

**If you choose to look (15 min):** get flagged content ruled — post
with one face, flag with another, `/moderation` with a third (or run
`npm run demo:phase5`), watch the blur, the ruling, the tombstone
citing the rule, and both inboxes learning their outcomes without
learning any names.

## Phase 6 — Circles ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** the action layer, spec-complete against `Circles/CIRCLES_SPEC.md` —
formation (25u rail, gate-cleared, live immediately, no approval queue) ·
thin founders (purpose/tags only, versioned — a Circle can't quietly
rewrite what it claimed to be) · browse/filter discovery + the
transparent values-alignment signal with its why in plain language
("Shown because you answered the X values question…" — no black-box
ranking, per the product-identity commitment) · join gate with the
DUAL_IDENTITY §7.1 small-community warning VERBATIM for Alias faces
(small OR place-tagged; informed choice with required acknowledgment,
never a wall) · members' room = Discussion primitive Circle-scoped
(members-only including reads, deletable class, never ledger-committed,
permanence upgrades blocked — the room is not the record) · resource
board (non-custodial listings; snapshot becomes permanent record only
when a logged action references it) · Circle-restricted Polls (Phase 3
machinery: member-only ballots, poll.created hash-commits the question
— tamper-evidence without disclosure; the §7 sharp rule holds — always
per-profile) · binding stewardship polls (remove-member at the Circle's
bar ≥ simple majority, close-circle, appoint-founder, attestation-dial
within rail bounds — consensus Adopt/Decline, auto-executed at close) ·
THE ACTION LOG: logged → attested (threshold rail, default 2, floor 2)
→ public civic ledger; append-only, no edit no delete, corrections by
reference; the honest claim fixed in the UI ("N verified humans put
their names to this claim — not that the platform verified it") ·
Light Score credits recorded for the Phase 7 engine (author 5 >
attestor 1, attested entries only, per-circle daily cap 10 +
diminishing returns — LIGHT_SCORE §5.1 guardrails as rails) · lifecycle
(inactive = derived honest label off the 90d rail, auto-lifting; closed
by poll only; failed Circles stay visible forever) · pillar pages
surface Circles by attested recency + the viewer's membership count ·
"circle-activity" quiet notifications (space name + event type only,
aggregated — NOTIFICATIONS §6 enclosed-space rule).

**Evidence:** 109 tests across 10 files (30 new in
`tests/circles.test.ts`); `db:verify` grew to 22 checks — Circle
integrity (formation fee + ledger evidence, membership rows ↔ public
events, action log re-hashes against its commitments, attestations
member-only/never-author/never-doubled, attested ⇒ ≥2 floor) and
members'-room privacy (room posts never on the ledger in any form,
offer ids never leak, circle-poll contentHash re-derives with no
question text, every circle-poll voter was a member, LS daily cap
holds) — both demonstrated FAILING LOUDLY under test (silent log edit,
smuggled self-attestation). `demo:phase6` walks the checkpoint end to
end. Live browser walkthrough (screenshots in session record): formed a
Circle through the UI (fee visibly charged), Alias saw the verbatim
warning at a place-tagged join and had to acknowledge it, action logged
under the permanence badge, attested by two co-signers with the state
flipping live to ✓ ATTESTED, the full chain on /ledger pseudonym-only,
the room refused to a signed-out guest. One real bug found by the
browser pass and fixed (form-in-`<p>` hydration remount swallowing
submits). Spec-conformance pass: every CIRCLES_SPEC section built or
explicitly flagged (domain-level pillar tags await Phase 7's domain
data; size filter in browse is display-only v1 — noted in
DECISIONS_PENDING).

**Derived/build-time rails set this phase (all flagged in
DERIVED_DEFAULTS.md):** small-community warning threshold 25 members ·
inactivity label 90 days · LS credits 5/1/cap 10 · removal bar default
60%, floor 50% · attestation threshold default 2, bounds [2, 8].

**If you choose to look (15 min):** `/circles` → form one (watch the
fee) → join it with your Alias somewhere place-tagged (read the warning
— that's DUAL_IDENTITY vector 5, said at the exact right moment) → log
an action → have another face attest → watch the badge flip and find
the whole story on `/ledger`. Judge: does the action layer make the
mission literal — is this where "we talked about it" becomes "here's
proof we did it"?

## Phase 6.5 — Fellow Souls & Direct Messages ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** the social layer, spec-complete against
`Fellow Souls and DMs/FELLOW_SOULS_AND_DM_SPEC.md` — mutual-consent
bonds between profiles, any face combination (the platform neither
knows nor asks whether two bonded profiles share a human) ·
initiator-pays requests (2u rail; accept/ignore/decline free; declines
SILENT; 30d cooldown + 30d expiry rails, swept) · **private graphs,
structurally** (§4): your list renders for you alone, no counts, no
third-party relationships, NO suggestion engine ever — and NOTHING
social touches the public ledger: every social gate clearance runs in
private recording, every fee entry is blinded (no counterparty
reference in the economy table) · encrypted DMs (X25519 → HKDF →
AES-256-GCM per message, thread-bound AAD; ciphertext-only at rest;
Phase A operator-escrowed keys DISCLOSED VERBATIM in the thread UI,
wallet-side cutover published for Phase 9 — the §9.1 stack resolution
is DECISIONS_PENDING #8) · strangers arrive as requests (initiator
speaks once, then waits; reply opens, decline closes, both free) —
fellow souls land direct · per-thread mute, quiet one-way per-persona
blocks (never notified; neutral refusals), delete-for-me (their copy
is theirs) · recipient-side excerpt reporting through the UNCHANGED
Phase 5 path: Flag/ModCase gained a DM-excerpt evidence pointer (post
XOR excerpt, verified), the case file shows the revealed words and the
accused's standing — never a handle; consequences are personal (strikes
+ LS in the meta pillar — flagged interim), no content actions inside
private threads, appeals unwind identically, the restorative option
appends the correction in-thread, and NO ledger event ever names a DM
case's accused · notifications per §5.3: fellow-soul DMs
time-sensitive, requests quiet, aggregated per thread, content never
rides a notification.

**Evidence:** 127 tests across 11 files (18 new in
`tests/fellowSouls.test.ts`, triple-run for flake); `db:verify` grew to
24 checks — social privacy (no social event types, no social row id
anywhere in the ledger, private clearances, blinded fees, notification
bodies scanned against decrypted plaintexts) and social
integrity/encryption (bonds normalized + consent-backed, every message
authenticates and decrypts under the re-derived thread key, expiry
sweep, evidence-pointer exactness) — both demonstrated FAILING LOUDLY
under test (plaintext smuggled into the ciphertext column; a bond
inserted with no accepted request behind it). `demo:phase6.5` walks the
checkpoint end to end. Live browser walkthrough (screenshots in session
record): request sent through the UI (fee visibly charged), quiet
request accepted (bond count visible only to its owner), thread opened
direct between fellow souls with the escrow disclosure banner, messages
both ways, recipient revealed one message and filed the report — case
open in the queue with deposit held and rule cited, and a final scan
showing zero social trace on the public ledger.

**Derived rules set this phase (flagged):** releasing a bond
(consent is ongoing — either side may withdraw, quietly) · DM-conduct
strikes land in the meta pillar (moderation is pillar-scoped; DMs have
none) · §3's Circle/Chamber invites await those surfaces' invite
mechanics (Circles are open-join in v1; Chambers arrive at 7.5) ·
fellow-souls feed source and search scope land with their Phase 7
hosts.

**If you choose to look (15 min):** sign in → souls → send a request
(watch the fee and the recipient's quiet inbox) → accept as the other
face's owner → open a conversation (read the escrow disclosure — that
honesty is the design) → exchange a few words → report one message and
run `npm run db:verify`. Judge: does "good people find each other"
feel mechanical now — and does the graph feel like nobody's business
but yours?

## Phase 7 — Light Score & The Dashboards ✅ OWNER-RATIFIED (2026-07-11)

Self-verified 2026-07-11; owner walked the checkpoint the same day
(signed in as a minted review soul, submitted a repair through the
live UI) and ratified: "that worked. we're good to proceed."

**Shipped:** standing became visible and the platform got its face.
**Domains became data:** all 56 domains (8 × 7 pillars, the Agora
included — its ratified capstone provides the full canon template)
extracted VERBATIM from the corpus breakdowns by a committed generator
script, seeded with ledger events, each with its permanent
Opening-Question thread (the canon reconciliation's second ring) and
its Picture as revision 1 of a living content object. **Light Score
v3:** the v2 engine ported deliberately (weights as rails; v2's
vote-received inputs don't exist in v3 by design — tips are NOT a score
input), deriving per-face per-pillar standing from public Discussion
contributions (members'-room posts never feed standing) + the
already-recorded adjustment rows (Circle credits, Phase 5 deductions
decaying on the strike clock) + moderation service derived per resolved
case, quality-gated, daily-capped, credited in the room actually
served; the ANTI-SUM GUARD throws on total/sum/overall/global/combined;
the owner-only score-change log names every cause ("Attested action in
Circle X," "Accepted repair on Domain Y"). **The dashboards:** hub
(grid-with-Agora-apart, the spec's sanctioned fallback; hook lines from
the Strategic Conclusions; per-pillar standing chips — a constellation,
never a sum), full pillar anatomy (Why banner with the three-name
identity + flagship Stoic principle, the pillar-only stat row, eight
domain cards with LIVE repair status, canon threads, Circles by
attested recency, the Governance door as a marked threshold, mechanism
deep-dives rendering the 12 reference docs verbatim), and dedicated
domain pages (every breakdown field; the Picture versioned with public
dated history; Open-for-Repair questions with a real submission
control). **The repair loop:** any verified soul challenges a Picture
free of charge (the fee lattice read strictly; one open repair per soul
per domain is the structural anti-spam); acceptance is a SYSTEM-opened
governance poll in the domain's pillar (consensus at the platform bar,
sealed + candled, executed at close via the Phase 6 binding-poll
pattern); adopted → new revision + Light Score credit with its named
cause; declined → nothing (honest misses stay safe). **Transparency:**
/transparency answers the three questions publicly — inflows by source
category, outflows by budget category (the Constitution's
must-guardrail rendered structurally: an unmapped flow THROWS, here and
in db:verify), issuance in its own section, the admin-log mirror as an
honest empty log, daily snapshots (owner-ratified cadence as a rail;
lazily generated, timestamped, ledger-evented, re-derivable),
drill-down to pseudonymous entries (stipends/rewards aggregate-only —
moderator anonymity beats itemization), CSV export, and the public
moderation-stats page. **Feed:** cold-start defaults (all seven
pillars + open lens + balanced diet), chosen sources only (pillars,
domains, join=follow Discussions, member Circles, followed polls,
fellow souls OFF by default), a why-line on every card, "you're caught
up" as a designed moment with an explicit mark-read, and the open lens
ranked by the published formula — versioned, rendered LIVE from the
rails at /feed/formula, arithmetic shown on every card, identical for
everyone. **Search:** nine entity types, visibility-scoped at the query
(rooms and DMs structurally absent; moderator identity unsearchable;
nothing cross-persona exists to leak), published ranking, per-face
deletable history never used to rank, §4.2 filters, and in-space room
search (owner-resolved: ships at launch). Circle formation gained the
domain tag — the Phase 6 flag, resolved.

**Evidence:** 150 tests across 13 files (23 new: the engine, the
anti-sum guard, decay, room exclusion, service quality-gating, the
repair loop both directions, per-persona feed separation, the
enclosed-space rule against a forged feed source, lens formula and
room exclusion, city search, souls lookup, history isolation,
snapshot re-derivation). `db:verify` grew to 27 checks — Domain &
Picture integrity (contiguous histories, every acceptance poll-backed
with Adopt leading, phantom credits impossible, "system" tombstoned),
Transparency books (every kind categorized; the snapshot re-derives
from the entries as of its timestamp), Feed & search privacy (nothing
on the ledger) — with snapshot drift and uncategorized flows
demonstrated FAILING LOUDLY under test. `demo:phase7` walks the
checkpoint end to end and ALL 27 CHECKS PASS on the exercised dev
database. Live browser walkthrough: hub tiles → Compassion's Why
banner and stat row → Domain 1 (Picture at v3, community-repaired,
full revision history) → a repair submitted through the real form (its
governance poll open in the room, sealed, candle-committed) → the
domain's live thread → /transparency with drill-down to pseudonymous
entries → the feed with why-lines and the caught-up moment → a Kelowna
Circle found by searching its city. (One walkthrough hiccup was
environmental, not product: running `next build` against a live dev
server corrupts its assets — restart the dev server after builds.)

**Flagged for the owner (non-blocking, queued in DECISIONS_PENDING):**
the 16 drafted Opening Questions (Compassion + Hope breakdowns predate
the template; drafts marked `derived-draft` in data and noted on their
pages; ratification edits are ledger-evented amendments per canon
law) · the Agora dashboard INCLUDED (the spec deferred it until its
content existed; the ratified capstone provides it — confirm) · repair
acceptance = system-opened governance poll (the spec names polls as
the resolution mechanism but doesn't specify the repair flow) · repair
submission free · lens weights derived as rails (§9.1 defers exact
weights to real data) · minimal poll cards in the feed (§9.3 rollout
order) · "system" handle tombstoned · repair-outcome notifications
deferred (the category list is exhaustive by design).

**If you choose to look (15 min):** the hub → Compassion → Domain 1
(read the Picture, note v3 and its history) → submit a repair → find
its poll behind the Governance door → `/profile` for your constellation
and change log → `/transparency` (drill into a category) → `/feed`
(tune sources, read the why-lines, reach "you're caught up") →
`/search` for your city. Judge: does standing feel earned and
explainable — and is this the face you wanted the platform to have?

## Phase 7.5 — Chambers (Pollinator v1) ✅ SELF-VERIFIED (2026-07-11)

**Shipped:** the idea incubator, launch scope per
`Neural Pollinator/NEURAL_POLLINATOR_SPEC.md` — **Chambers only**
(Leaderboard/Tournament post-launch by owner decision; the data model
does not preclude them: public/private flag, storefront, per-layer
permanence classes). Creation through the FULL pre-convo scaffold
(three first-class fields — what are we solving / what do we need to
know / what does success look like — creator-sharpenable with edit
history visible in the workshop) + the required storefront "why should
people care" (what problem, for whom, why now) · **the dual-token
signature**: creation 20 PC + 20 G, workshop posts 1 PC + 1 G (rails;
the first surface priced in both tokens — both halves clear or
neither) · public/private FIXED at creation; private chambers are
creator-invite-only and never compete · **the three visibility
layers**: storefronts public and free for every chamber (a private
chamber's is minimal — name + private marker), the workshop
enter-to-see (the Discussion primitive chamber-scoped — threading,
grace windows, moderation all reuse; NO bespoke machinery), the Arena
reserved for post-launch · **the creator's Light Score public on
public storefronts** (owner addition — per-face per-pillar, never a
sum; transparency instead of gatekeeping per resolved OQ5: entry =
the gate + carrying both tokens, no Light Score floor) · **the
enclosure is structural**: chamber membership is enclosed-space
information (the storefront publishes count + coarse activity level,
never the list; entry/invites/workshop posting all clear the gate in
PRIVATE recording), workshop drafts never hash-commit, never
permanence-upgrade, never feed Light Score, the open lens, or public
search — while standard Phase 5 moderation applies inside as
everywhere (flags on workshop posts feed the unchanged path). Phase 7
hand-offs consumed: the entered-chambers feed source (membership-
verified; forged sources feed nothing) + chamber storefront cards
("New in the Pollinator," legible ordering stated on the card) +
storefront search (never interiors; ninth-entity content type grew
the label) + in-space search inside workshops (owner: launch) +
"fee.chamber"/"fee.chamber-post" categorized in the transparency
books (an unmapped flow throws, by design) + the ratified
"chamber-activity" quiet notification category (aggregated,
space-name-only).

**Evidence:** 175 tests across 14 files (25 new in
`tests/chambers.test.ts`); `db:verify` grew to 29 checks — Chamber
integrity (dual fees both halves 1:1 with chambers and workshop
posts, chamber.created on-ledger, exactly one deletable workshop
each, scaffolds complete, workshop authors entered, private entry
invite-backed) and Workshop enclosure (drafts unleaked and never
upgraded; member/invite/workshop ids nowhere in the ledger; every
chamber clearance private) — tampering demonstrated FAILING LOUDLY
under test (a member smuggled into a private chamber, a halved dual
fee, back-door permanence on a draft). `demo:phase7.5` walks the
checkpoint end to end; all 29 checks pass on the exercised dev
database. **Live browser walkthrough** (screenshots in session
record): signed in as a review soul, created "Walkable Winters"
through the full scaffold form, watched the header pay both halves
(48.90→29.90 PC, 30.00→10.00 G), read the storefront (pitch,
why-care, creator standing honestly "no standing yet," count-never-
list), posted a first-principles draft in the workshop (composer
priced "1 PC + 1 G," G visibly −1), then proved the enclosure from
outside: signed-out requests to the workshop URLs get the refusal
with a storefront pointer and zero draft text; the draft's words
return nothing in public search while the storefront returns the
chamber; the feed carries the storefront strip; the ledger holds
chamber.created and zero workshop references.

**Derived rules set this phase (flagged in DECISIONS_PENDING #12):**
"carrying both tokens" read as nonzero in each · membership enclosed
(count public, list never — private clearances) · private storefront
minimal · invite notifications await a category (invites surface on
/pollinator) · workshop permanence upgrades blocked · workshop posts
excluded from Light Score · fee transparency mapping.

**If you choose to look (15 min):** `/pollinator` → open a chamber
through the scaffold (watch both balances drop 20) → read your own
storefront the way a stranger would (your standing is on it) → work
the idea in the workshop (1 PC + 1 G per post) → sign out and try the
workshop URL, then search for your draft's words (nothing), then your
chamber's title (storefront) → `npm run db:verify`. Judge: is this
the incubator you designed — public face, enclosed workbench, priced
in both tokens?

## Phase 8 — Deployment Hardening ⚙ BUILD HALF SELF-VERIFIED (2026-07-11) — checkpoint awaits YOUR cohort

**The split, stated plainly:** everything BUILD_ORDER names for Phase 8
is built and verified below. The checkpoint itself — a small real
cohort (not you) onboarding unaided, funnel and logs reviewed together
— is inherently yours: recruiting the cohort, provisioning the staging
host (DECISIONS_PENDING #14; billing/accounts are owner-inherent), and
the joint review. The build half is ready for that day.

**Shipped:**
- **The Postgres track** (DATABASE_SETUP.md; Build Law rule 4's
  SQLite-only era ends here): prisma/postgresql/schema.prisma with
  model definitions BYTE-IDENTICAL to the SQLite schema, consolidated
  0_init migration, `db:validate:postgres` parity check wired into
  `npm run check` (drift fails the build), `lib/runtimeConfig.ts` —
  a hosted environment REFUSES TO BOOT on a non-Postgres/placeholder
  DATABASE_URL, weak trust secrets, or an undeclared proxy.
- **Backups & DR** (BACKUP_DR_SPEC, owner-ratified): nightly pg_dump +
  retention (30 daily / 12 monthly, rails; cadence IS the RPO rail,
  bounds 1–24h — tightening is a config change by design), the monthly
  automated restore drill (restores the latest backup to scratch, runs
  the FULL invariant suite on the restored copy — recovery is provably
  untampered, exits nonzero: a failed drill is a production incident),
  the worst-day restore with its consent gate, and docs/RUNBOOK.md
  (cron schedule explained, quarterly manual drill checklist, the
  corruption/outage/compromise decision tree). Every backup/restore/
  drill run lands on the PUBLIC admin log (admin.backup.* ledger
  events, operator-attributed), rendered on /transparency.
- **The consolidated rate-limit schedule** (ANTI_SYBIL_CONSOLIDATION §3
  watch-item W4 — closed): sixteen ratelimit.* rails (limits anchored
  to the v2 platform's proven limiter, the Light Score anchor
  discipline; windows structural: burst/hour/day-cycle), enforced at
  EVERY write action via requireFace(policy) + a global backstop;
  pre-identity ceremonies keyed on session + proxied address; the
  faceSwitch wall is anti-automation, NOT a cooldown (owner: none).
  Walls sit at machine speed — fees remain the ratified throttle.
- **The minimal-log discipline audit** (DUAL_IDENTITY §7 vector-4
  review — docs/LOG_DISCIPLINE_AUDIT.md): application code logs
  NOTHING (zero console lines in lib/+app/, no IP/UA/device/geo column
  anywhere — both now GUARDED by tests), headers() has exactly one
  audited consumer (HMAC-fed, never stored), rate-limit counters are
  HMAC-keyed and pruned, host access logs identified as the one
  out-of-repo vector with a binding posture requirement. The honest
  finding, named: SoulSession co-residency is the one operator-space
  surface both faces share — inherent to Phase A, within the ratified
  disclosure's words, swept short-retention, dissolves at Phase 9.
- **The analytics funnel** (ANALYTICS_SPEC, privacy-constrained):
  in-house-minimal pipeline (tool selection resolved + flagged #13 —
  the ratified constraints are STRICTER than Umami/Plausible defaults);
  an event is a NAME and a MOMENT (structurally no payload); CLOSED
  measured vocabulary; subject keys HMAC'd on exactly three event
  types (provably unjoinable to rate-limit keys); onboarding funnel
  instrumented at the ceremonies; the 90-day crush (rail CAPPED at 90
  — lengthening is structurally a code change) into permanent
  aggregates + cohort curves; /commons — State of the Commons, the
  honest growth numbers public; analytics NEVER feeds ranking (feed/
  search importing the pipeline fails the suite).
- **Staging deployability**: docs/DEPLOYMENT.md (host requirements
  matrix, step-by-step staging setup), hosting recommendation Render
  (flagged #14 — provisioning is yours), smoke:staging (signed-out
  landmarks on the eight public surfaces). Deliberately NOT set up:
  observability SaaS (needs its own §7 review first), email, CDN,
  object storage.
- **Cold start confirmed + early-platform honesty**: fresh-seed
  walkthrough green (canon + pillar content IS the seed — 105
  Discussions alive with zero user content; every empty state honest);
  below 25 active souls (rail) the Alias ceremony says plainly that a
  small crowd thins anonymity (§7.2's own directive, flagged #16).
  Invite mechanics deliberately NOT built — your launch-gating
  decision, queued #15 with a recommendation (the cohort needs only an
  unlisted staging URL).

**Evidence:** 206 tests across 15 files (31 new in
tests/hardening.test.ts); `db:verify` grew to 31 checks — Ops &
counter hygiene (HMAC-shaped bucket keys, payload-allowlisted +
operator-attributed admin events) and Analytics discipline (closed
vocabulary, scoped HMAC subject-keying, retention honored with crush
grace, ledger clean) — both demonstrated FAILING LOUDLY under test (a
raw session id smuggled as a counter key; a sourceIp field in an ops
payload; a 'dwell.time.ms' event). `demo:phase8` walks the checkpoint
build-half end to end; all 31 checks pass on the exercised database.
**Live against a real PostgreSQL 17:** migrate deploy (0_init) → seed
→ ALL 31 CHECKS PASS → backup → restore drill green end to end (the
restored ledger verifies untampered), and a deliberately corrupted
archive FAILS the drill loudly (exit 1, ok:false on the admin log).
**Live browser walkthrough on a fresh cold-start database:** a soul
onboarded unaided through the real UI (gate → credential → True Self →
consents → orientation, grants visibly landing → values seed → first
post in a canon thread, fee labeled); /commons tracked every funnel
step exactly (1-1-1-1-2-1-1-0); the pace wall fired live on the 6th
verification attempt ("Refused, honestly… try again in about 42
minutes"); the early-platform note rendered at the hatch ceremony.
Spec-conformance pass: DATABASE_SETUP, BACKUP_DR (§6.2 media lane N/A
— no uploads at launch), ANALYTICS (§3 infrastructure vitals are the
host dashboard's lane, noted in DEPLOYMENT.md), ANTI_SYBIL W4,
DUAL_IDENTITY §7 — every line built or explicitly flagged.

**Flagged for you (non-blocking, queued in DECISIONS_PENDING):**
#13 analytics tool selection + /commons placement + public stat set ·
#14 hosting provider (Render recommended; provisioning + ~$25–40/mo
are yours) · #15 invite mechanics / launch gating (recommendation:
cohort via unlisted URL, decide gating for public launch) · #16 the
early-platform crowd-size note wording.

**What only you can do to close Phase 8:** (1) provision staging per
docs/DEPLOYMENT.md §3 (~an hour of dashboard work); (2) recruit the
small cohort and hand them the URL; (3) when they've onboarded
unaided, we review the funnel (/commons) and the logs together. The
build will be waiting.

**If you choose to look (15 min, no staging needed):** `npm run
demo:phase8` (the walls, the counters that know nobody, the crush, the
guard refusing an unsafe boot, all 31 checks) → then in the browser:
try to verify 6 times fast (meet the wall, read its refusal) →
`/commons` (watch the funnel move as you onboard a throwaway soul) →
`/transparency` (the admin log now shows backup drills) → `/alias`
(read the early-platform honesty note). Judge: is this a platform
other humans can touch?

## Phase 8.5 — The Presentation Era ⚙ BUILD SELF-VERIFIED (2026-07-14) — checkpoint is YOUR walkthrough, by design

**The gate this phase answers to is different from every other phase:
§8 of the ratified spec makes YOUR eyes the checkpoint — "is it
neither bland nor confusing?" The build half below is complete and
verified; the phase closes when you walk it.**

**Shipped (five slices, committed in sequence fa336b6 → ace7258):**
- **THEME = IDENTITY (§2):** a design-token system in globals.css;
  three rooms — reader (aqua blue: "free to read" made visible),
  True Self (white), Alias (dark) — keyed to the FACE server-side;
  prefers-color-scheme deliberately not consulted (the safety signal
  always wins). §2.3 cross-theme constants pinned: the permanence
  amber, refusal notices, and the ◆/◇ chips render identically in
  all three rooms — the True Self chip IS the white card even in the
  dark room. The card flip (§2.2) fires on every face change,
  including the §2.4 blue→white verification moment; crossfade and
  instant ship behind the per-face setting.
- **The Agora dashboard IS the platform dashboard (§1.1,
  owner-corrected):** / carries the what-is-this-place framing, the
  feed (per-persona / open lens), the Agora pillar's full anatomy,
  and doors to everything else; /pillars/agoranet redirects home.
  The pillar dashboard body became ONE shared component with two
  mounts. The blessed left nav (§1.3) is persistent, collapsible
  small-screen without JavaScript, one-liners as tooltips, workbench
  only for badge-holders. New findable-by-name indexes: /discussions
  and /governance; the Seven Pillars grid moved to /pillars.
- **Doors + one-liners (§1.4 + §3.2):** every domain card and domain
  page (top AND bottom) carries "Join the Discussion — N voices" in
  a door style that can never be confused with the amber permanence
  threshold; all eight blessed one-liners lead their features.
- **Settings + the profile window (§5.1–5.2):** /settings per-face
  (the linkage-surface rule stated on the page); display name moved
  there; switch animation per face; /profile is the window (bio +
  self-placed place, live-surface never permanent; the Alias
  composer renders the ceremony's stylometry warning VERBATIM by
  importing the constant); /souls/[handle] is the public window —
  nothing on it is new information. Schema: three additive Profile
  columns in both provider schemas + postgres migration
  1_profile_window; parity green.
- **The design pass + icon family (§5.3 + §6.2–6.3):** Fraunces +
  Inter self-hosted (no font CDN — the no-third-party law); one
  matched SVG icon family replaced every UI emoji EXCEPT the seven
  pillar glyphs (owner-ruled: kept as symbols); buttons look decided;
  stat rows, card hover, type rhythm; the workbench got its
  at-a-glance term stats.

**Evidence:** 206 tests across 15 files green after every slice
(mechanics pinned — this phase moved none); `npm run check` exit 0
(typecheck + dual-schema parity + production build); `db:verify` ALL
31 CHECKS PASSED; grep-proofs: zero prefers-color-scheme behavior,
zero production mentions in UI, zero emoji outside pillar glyphs.
Live browser walkthrough: the reader's blue gate → verification →
the world turning WHITE with the flip firing (witnessed) → the dark
room's CSS verified with the True Self chip staying the white card →
sidebar blessed-order + mobile collapse toggled → /discussions,
/governance, /pillars, domain doors ("Join the Discussion — 2
voices"), settings, the profile window saved end-to-end and rendered
on the public soul window → sign-out flipping the world back to
blue. One derived rule flagged (DECISIONS_PENDING #21): the merged
dashboard's threshold parks nothing; the Agora's interior doors park
exactly as always.

**Environment notes for future sessions:** `npm run check` builds —
restart the dev server after it (the Phase 7 gotcha, reconfirmed).
The browser pane can wedge a tab at viewport 0×0 (clicks silently
miss; resize_window fixes) and only screenshots the top ~1000px of
long pages — DOM inspection covers the rest; neither is a product
issue.

**Your checkpoint (§8, whenever you like):** walk it end to end —
arrive signed out (the blue room), read the front door, verify a
throwaway soul (watch the world turn white), tour the sidebar's nine
doors, open a domain and step through its Discussion door, write
your window in /profile, pick your switch animation in /settings,
hatch an Alias and switch to it (the dark room; the flip). Judge the
one question the phase exists for: **is it neither bland nor
confusing?** Rule on it and 8.5 closes; 8.6 — the chain rails — is
ratified and waiting right behind it.

### Phase 8.5 addendum — the owner's walkthrough + slice 7 (2026-07-14)

The owner walked the build the same day (his own browser, his own
souls — hatched @bradpitt through the real ceremony). Findings, all
addressed in commit b9cb2c7: one-time secrets needed a copy control
(built, with layered clipboard fallbacks); the once-per-browser
nature of face login was never stated (now stated at both key
screens and login); no way to know when an Alias activates (the
key screen now says: try the key — the day it works, it's live —
and why no notification can ever say so); single-face sessions now
point at where the switch control will appear. His sequential-
parking question was answered from the ratified record (the lock
forbids co-presence, not succession; the cooldown rail — HIS dial,
currently 0 by his own ruling — governs rapid succession). His
self-reply scenario was answered from the ratified record (one
alias ever, fees, score-inert, stylometry self-exposure) and he
ruled the containment holds: "simpler is better. It stays."

**Owner directive from the walkthrough (spec §4 amended):** clearer
labelling and front-facing messaging, starting with onboarding —
the visible seven-step journey + the carried arrival at the Agora
Dashboard, built as slice 7. **His interim verdict: "ok, so this is
good enough for now. Both profiles work. Hatching works."** He then
began his 8.6 §6.5 setup (Blockfrost ✓, Docker ✓, Lace in progress)
— the formal 8.5 close rides his go for 8.6.

## Phase 8.6 — Testnet Rails ⚙ IN PROGRESS (slices 1–2 SELF-VERIFIED 2026-07-15)

**Slice 1 — the Cardano rail: LIVE.** The owner's dev wallet
(tAgoranetv3, preprod, 10,000 faucet tADA) connected through the new
per-face testnet-rail section in /settings (TestnetWalletLink model —
mainnet refused at every layer, 4 tests pin it). PollCoin Demo
(dPOLL, owner-ruled name) minted: 1,000,000 units under throwaway
policy 70e8fedff8a8cd445705a0884c8b41db20e5005f7cdeef6a7322ad35, tx
4872f42b1885d6a1ef9c0fd58df011ed4138e8c6d55bef387a42c6ba8d1669c0.
First civic-ledger anchor: head hash of seq 407 in tx
ccbdeb986b5ea20d8b634d7e1206080ad9597b350871a675498a6d252a3ef005
(CIP-20 label 674); seq 407's anchorRef now carries it — the Phase 0
field's first use. Machinery: lib/chainMint.ts + scripts/chain/
(mint-dpoll, anchor-ledger), throwaway mint key + Blockfrost preprod
key in gitignored .env only. Lesson recorded: the owner's Eternl
testnet stash was on PREVIEW, not preprod — same address format,
different chains; the faucet resolved it.

**Slice 2 — the Identus issuer: LIVE.** infra/identus/docker-compose:
two pinned Cloud Agents 2.2.0 (issuer + holder) + prism-node 2.6.0 +
postgres. scripts/chain/identus-loop.ts runs the complete ceremony:
published did:prism DIDs → DIDComm connection → registered schema →
JWT W3C VC issued carrying a STABLE SUBJECT COMMITMENT →
presentation verified under named schema + trusted-issuer
constraints. §1.5 RECOVERY PROVEN: same commitment reissued across
two ceremonies with different holder DIDs re-derives IDENTICAL
platform nullifiers (run twice, nullifier 080e2a7d… both times).
Build gotchas recorded for the next session: custom DB names need
*_DB_APP_USER env; holder DIDs need authentication-purpose keys;
DIDs must be PUBLISHED or verification fails resolution; match
holder records by thid or stale runs bleed in; docker compose down
-v resets the stack clean.

**Evidence:** tests 210/210 after every commit (4 new chain tests);
db:verify 31/31; commits 0ee2ad3 → 9d4ab44, all pushed. Slice 3:
tests 210/210 and db:verify ALL CHECKS PASSED re-run 2026-07-15
after the Midnight work (app tree untouched by design — the Midnight
SDK lives in the standalone infra/midnight package, testnet mode
additive per §6.6).

**Slice 3 — the Midnight nullifier contract: LIVE (2026-07-15).**
The gate's one-per-scope law now holds on a public ZK testnet by
math. Contract `infra/midnight/contract/nullifier.compact` (Compact
0.23, toolchain 0.31.1) deployed to Midnight PREVIEW at
`1479b8b7ab53073b27623d960dd8c5d6fd429b2fafb73349d782fbeb638dd052`,
exercised end-to-end via the dev proof server (proof-server 8.1.0,
fresh pinned container `agoranet-midnight-proof`; the prior-attempt
fossil container and its images REMOVED). Four properties proven
live on-chain (infra/midnight/exercise.ts, EXERCISE_OK):
CLEARED — spendPerProfile, tx 00eeacd8e2d0…90a7be, block 1612964
(17.6s proof); DUPLICATE — the same subject re-trying the same scope
refused by the ledger-Set member-check, no identity revealed;
collision guard — the same scope through the per-human door CLEARED
(distinct kind tag), tx 00a1e9b599a1…5d2318, block 1612967;
public math — both nullifiers re-derived locally via pureCircuits
and found in the public Set (size 2). The contract mirrors
lib/nullifier.ts exactly: persistentHash[domain separator, kind tag,
scope, secret] vs HMAC(secret, `${scopeKind}:${scope}:${subjectId}`)
— same fold, same two scope kinds, and the witness (slice 2's stable
subject commitment, §1.5) rides the proof, never the chain.
nullifierFor's TS signature is untouched (the Phase 0 promise). The
owner's faucet moment happened 2026-07-15: 1000 tNIGHT from the
Nethermind Preview faucet (faucet tx 00cfe20167eb…504e) — everything
else (dust registration via registerNightUtxosForDustGeneration,
tDUST accrual, deploy, spends) ran programmatically. Secrets
(MIDNIGHT_DEPLOY_SEED, MIDNIGHT_SUBJECT_COMMITMENT, contract addr)
live only in gitignored .env; .env.example carries the shapes.

**Slice 3 build gotchas for the next session:** the SDK still moves
weekly — compact-js@latest (2.5.3) depends on an UNPUBLISHED
ledger-v9 alpha (npm 404): pin 2.5.1 (the ledger-v8 line). The
newest wallet-sdk majors (facade 4.0.1) break the documented API:
pin example-counter's proven line instead (facade 3.0.0, dust 3.0.0,
hd 3.0.0, shielded 2.1.0, unshielded 2.1.0) — it coexists fine with
the matrix-current core (compiler 0.31.1 ↔ compact-runtime 0.16.0 ↔
midnight-js 4.1.1 ↔ ledger-v8 8.1.0, npm-deduped to one ledger).
WalletFacade.isSynced requires ALL THREE sub-wallets strictly
complete; the DUST wallet syncs ~15× slower than shielded and is
invisible unless you print it — a fresh wallet's first sync is
~15 min on Preview and looks wedged without a heartbeat (wallet
state is not persisted across runs; every cold run pays it again).
Node's WS needs `globalThis.WebSocket = WebSocket` (ws) for indexer
subscriptions; RPC-CORE "Normal Closure" chatter at startup is
benign. Proofs on this machine: deploy 19.8s, spends ~18s each —
inside the honest 20–60s window. ONE SELF-CAUGHT SLIP, fixed the
same hour: levelPrivateStateProvider writes its store to
`midnight-level-db/` under cwd (NOT the privateStateStoreName), so
commit 8f70206 briefly carried the private-state db (holding the
DEMO subject commitment — testnet-only, no real value); removed from
git + properly ignored in the follow-up commit, and the demo
commitment ROTATED in .env. Lesson: verify a provider's on-disk
paths before trusting a guessed .gitignore entry.

**Slice 4 — the honesty layer: BUILT + REHEARSED (2026-07-15).**
- **Daily anchor cadence (§3):** lib/chainAnchor.ts (cadence brain,
  pure DB) + the cadence-aware `npm run chain:anchor` runner —
  idempotent, joins the ops-job roster Railway will schedule; rail
  `anchor.cadenceHours` (24h, ARWEAVE_RECORDS' daily cadence); skips
  when not due OR when the ledger's newest event is its own last
  anchor (an idle ledger needs no fresh witness); `--force` for the
  demo. Every anchor writes BOTH sides: the anchored row's anchorRef
  and a public `ledger.anchored` event. First cadence anchor is LIVE:
  seq 408 witnessed in preprod tx d2984b22853d230f80b6e1aa217d1a1fe3
  52b168b775027fae066158f66606a7 (event seq 409); immediate re-run
  correctly ANCHOR_SKIPped. db:verify check 27 (anchor integrity:
  event ↔ row ↔ hash agreement) — loud-failure-tested by swapping an
  anchorRef.
- **Disclosures upgraded, ONLY where trust became math (§4):**
  PHASE_A_DISCLOSURE (lib/gate.ts) — the replacement is "no longer
  hypothetical," names the public Midnight contract, keeps the
  trust-us claim standing for the live gate. GATE_INTRO.interimIssuer
  — honest present tense (Identus runs today, platform-operated,
  testnet), PLUS the two hard truths added: no recovery on the
  interim path, and repeat-verification is undetectable until a real
  identity partner (the W5/#20 copy pass, done). Credential screen —
  the #17 plain-words loss warning added WITH the proven-recovery
  context. ALIAS_DISCLOSURES item 1 — the math is real on test
  rails, the live ceremony still policy; consent version bumped
  phase-a-v2 (identity.ts now reads CONSENT_VERSIONS instead of a
  hardcoded string). DM escrow disclosure UNTOUCHED — still true.
- **/transparency "What runs on real rails today" (§4):** live
  section rendering from env + the ledger: dPOLL policy (explorer
  link), latest anchor (seq + tx link + cadence), Identus status,
  Midnight contract address — and the what-does-NOT-run-on-chain
  list so nothing oversells. Browser-verified rendering with real
  data, alongside /verify's upgraded notices and the credential
  screen's new warning.
- **Evidence:** tests 212/212 (anchor cadence + verify-27 tamper
  added); db:verify 32/32 incl. the new check on the REAL anchor;
  `npm run check` exit 0. Environment note reconfirmed: the browser
  pane can wedge clicks (viewport mismatch — POSTs never reach the
  server); click by screenshot coordinates when refs miss.

### The two §5 demos — the owner's runbooks (rehearsed 2026-07-15)

**Demo 1 — the walking demo ("come try"):** every step below was
rehearsed live this session.
1. Open /transparency → "What runs on real rails today" — the
   framing card. Click "verify the minting policy" (dPOLL on
   cardanoscan) and "verify the transaction" (the latest anchor).
   Two browser tabs of PUBLIC proof, no trust required.
2. In /settings (True Self face): the testnet wallet link — connect
   Lace (preprod). Mainnet is refused by construction; say so.
3. Sign out → the blue room → /verify: read the TWO notices aloud —
   what is math today, what is still trust, in plain words. Verify a
   throwaway soul; the credential screen now states loss/recovery
   honestly. Act once (reply in a canon thread) — the gate clears it.
4. The ZK law, live: `cd infra/identus && docker compose up -d` (if
   down), proof server via `cd infra/midnight && docker compose up
   -d`, then `cd infra/midnight && npm run exercise` — a spend
   CLEARS (~18s proof, dev-grade by scope — say so), the SAME scope
   again is REFUSED by the chain, per-human vs per-profile never
   collide, and the nullifiers re-derive locally from public math.
5. Anchor the day: `npm run chain:anchor -- --force` from the
   platform root → paste the printed explorer link — the ledger head
   that now includes everything just done, witnessed publicly.
   (Without --force it correctly refuses when not due — also worth
   showing: the cadence is a rail, not a habit.)

Demo 1's step 4 rehearsed in the exact mode the runbook uses:
`npm run exercise` JOINED the deployed contract (1.7s, no redeploy)
and re-proved all four properties on it — CLEARED 18.3s, DUPLICATE
refused, kinds-never-collide 18.8s, public Set (size 4 after this
run) matched local re-derivation. EXERCISE_OK, exit 0.

**Demo 2 — "I lost everything" (§1.5 recovery):** rehearsed twice
this session; identical nullifiers both times.
1. Frame it: on the interim path, a lost credential is GONE — the
   credential screen says so. This demo is the real rail answering.
2. `cd infra/identus && docker compose up -d` (healthy in ~1 min).
3. First ceremony: `SUBJECT_COMMITMENT=<any 64-hex> npx tsx
   scripts/chain/identus-loop.ts` — a full issue→hold→verify loop;
   note the printed alias-registration nullifier.
4. "Lose" the wallet: run the SAME command again — a brand-new
   holder DID (a brand-new wallet), the same human re-proved to the
   issuer. The nullifier prints IDENTICAL. Same handle, same Light
   Score, nothing orphaned — recovery by mathematics, not by a
   support ticket.
5. If the schema-registry 503s, `docker compose down -v && docker
   compose up -d` resets the stack clean (recorded gotcha).

### The owner's walkthrough + BOTH §5 DEMOS GIVEN (2026-07-15)

The owner walked the full onboarding with fresh eyes and then gave
both demos from his own terminal, guided once (the runbooks carry
everything said; the next run is his alone): the ZK exercise to
EXERCISE_OK (his spends are Set entries 5–6, txs 0072832021…497cbe
et al.), the anchor honest-refusal + forced stamp (seq 412 — a head
that includes his own morning's walkthrough — in tx 266b83cfd2…
fc313d), and the recovery demo twice (commitment 07ad61d8…, two
different holder DIDs, identical nullifier da10360e… both runs).

**His findings, all addressed same-session (commits c532ba8 + the
round-2 commit):** the Constitution and the 22 rules were not
readable on the platform → /constitution + /rules, public, in the
Public Record nav, linked from the consent screen; consent texts
de-jargoned ("canonical" out, moderators = community members, "no
rule, no punishment" rephrased) with versions bumped and
hasPostingConsents made version-aware (a latent gap — reworded
consents never actually re-presented); the two secret screens now
explain passport-vs-house-key, name their step, and offer one-click
Download (alias key downloads under the same generic filename — no
linkage artifact on disk); "enforced blind by the registration
nullifier" and kin became plain words on both ceremony pages; the
values seed no longer collapses unanswered questions (read as "you
only get two"). Vocabulary question face→Persona PARKED by owner
(DECISIONS_PENDING #23). His sharpest demo question — "the system
could alter something and then stamp it" — and its answer (each
stamp closes the past; a post-alteration stamp publicly contradicts
prior stamps) is now part of the demo script above.

**Remaining in 8.6:** the owner's ruling. He has given both demos;
the phase closes when he says it does.
