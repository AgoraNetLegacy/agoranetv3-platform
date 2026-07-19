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

**★ PHASE 8.6 CLOSED — owner ruling, 2026-07-15: "this was great.
8.6 is done."** Given the same day he gave both demos himself. The
blockchain threshold that ended v1 and v2 is, in v3, a closed
checkpoint with public transaction hashes.

### Post-close polish — the Public Record gets a front door (2026-07-15, learning era)

Owner finding, revisiting the rules page after close: "The Public
Record" read as a clickable nav title but was a dead group label,
and its five sub-links (ledger/transparency/commons/constitution/
rules, all added this same day) were cramped into one small row.
Owner's own call on the fix, offered a quick-patch-vs-landing-page
choice: **the landing page** — "presents all five with one-line
descriptions in the platform's door style, and the cramped sub-row
disappears entirely." Built to match: new `/record` page reuses the
existing `pillar-grid`/`tile-title`/`hook` pattern from `/pillars`
verbatim (no new CSS component — one more room in the building, not
a bolt-on), one door per record surface with a one-liner each. The
sidebar's dead group label became a real `Link` to `/record`; the
now-unused `.nav-group`/`.nav-sub` CSS rules were removed rather
than left orphaned. Browser-verified: the tile grid renders
correctly and the sidebar link's href resolves to `/record` (a
known browser-pane click-miss quirk meant confirming via direct
navigation + href inspection rather than a literal click — both
checks passed). Tests 212/212, db:verify ALL CHECKS PASSED, `npm
run check` exit 0.

---

## Phase 8.7 — The Treasury's Other Half ⚙ IN PROGRESS (Slice 1 SELF-VERIFIED 2026-07-16)

**The phase the owner scheduled 2026-07-16**, reversing his own "I am
done building" — on the argument that Fund Integrity's components all
already run, so a working demo proves *integration* (the real moat)
better than presentation polish would. Spec:
`Fund Integrity/PHASE_8_7_SPEC.md` (+ `FUND_INTEGRITY_SPEC.md` policy,
`COMMUNITY_ENDOWMENT_SPEC.md` source). `BUILD_ORDER.md` carries the
phase between 8.6 and 9. Internal points only — **no legal gate**
(NEURAL_POLLINATOR §9.1: "No legal gate applies").

### Slice 1 — Budget categories + the outflow primitive ✅ SELF-VERIFIED

**Why this slice is the keystone.** A repo audit found that
`PLATFORM_CONSTITUTION` Appendix A's must-guardrail — *"the treasury
MUST NOT spend outside budgeted categories"* — and
`TREASURY_DASHBOARD_SPEC` §1.3's promise that it is *"rendered
structurally: an outflow without a budget category cannot exist"* were
**law with no code behind them**. There was no category model, no field,
no enforcement, and no `payFromTreasury` — every outflow was hand-rolled
at its call site, so there was nowhere for the rule to bind. **This
slice makes a constitutional guardrail true for the first time**, and it
is the precondition for bounties (TOKENOMICS §6.2) and Circle projects
(§6.4) alike — worth building even if Fund Integrity were abandoned.

**Built:**
- `lib/budget.ts` — the three categories TOKENOMICS §3's treasury loop
  already names (`moderation-rewards`, `tribunal-stipends`,
  `platform-operations`), seeded as data. Nothing invented: **"cause
  funding" is deliberately absent** — the treasury has no such purpose
  in the ratified economics, and Fund Integrity's source is the
  Community Endowment, a pool *beside* the treasury. `seedBudgetCategories`
  is idempotent and **never touches `active`** — deactivation is a
  governance decision a redeploy must not quietly undo.
- `BudgetCategory` model + `EconomyEntry.budgetCategory` (both schemas,
  SQLite and Postgres, kept in parity; the consolidated `0_init`
  migration gained the table + FK).
- `economy.payFromTreasury()` — **the single door money leaves by.**
  Refuses (never throws) on a missing, unknown, or inactive category.
  Enforcement lives in the primitive rather than at the admin console
  deliberately: a console check guards the surfaces we remembered; a
  primitive that refuses guards the ones a future session forgets. Same
  reasoning as ADMIN_OPS §1's allowlist — safety is the *absence of a
  path*, not the presence of a check.
- **Four** outflows refactored onto it — and the fourth is the story
  below.
- **db:verify check 33:** every outflow categorized · no unknown
  category · no *inflow* miscategorized (the inverse leak would corrupt
  every budget-utilization figure the dashboard derives) · the three
  ratified categories present and active (a deploy that loses them
  doesn't crash — moderators just quietly stop being paid; this fails
  loudly instead).

**★ The check earned its keep on day one.** My code audit found three
outflows (flag refund, badge reward, Tribunal stipend). Check 33
immediately failed on a **fourth I had missed** — `refund.appeal`
(`moderation.ts:933`), the Tribunal appeal-deposit return. A grep sweep
for `fromTreasury: true` confirmed no fifth exists. That is precisely
the failure mode this slice was built to make impossible, catching a
real instance of itself before it shipped.

**Deliberately NOT built (flagged, not invented — CLAUDE.md rule 1):**
category **caps** are not enforced. The column exists so the guardrail
has somewhere to land without a later migration; the three shipped
categories are uncapped by design (their amounts are already
rail-governed per-action). Promoting cap ceilings to Class 2 is
`FUND_INTEGRITY_SPEC` §3.6's *unratified constitutional proposal* — this
phase does not pre-empt it.

**Evidence:** tests **219/219** (7 new: seeded-set shape · pays-and-
stamps · **refuses unknown category** · **refuses inactive category** ·
fails loudly on an uncategorized outflow · fails loudly on a missing
ratified category · fails loudly on a miscategorized inflow — every
guardrail proven to *fail*, not just to pass). `npx tsc --noEmit` clean.
db:verify **ALL CHECKS PASSED** (33 checks). Browser: `/transparency`
renders clean, no server errors — its kind→display map is independent of
the new constitutional column, so the two coexist without collision.

**NEXT:** Slice 2 — the source-agnostic escrow primitive (tranche
schedules, release on attestation threshold reusing the `Attestation`
shape at `schema.prisma:927`, freeze on upheld Tribunal ruling, both
**automatic** with no operator discretion step per FUND_INTEGRITY §3.7).
Open before Slice 2: PHASE_8_7 §8 Q6 — Appendix A's Circle attestation
dial reads "floor 2" with **no upper bound**, while POLLINATOR §9.1
asserts `[2,8]` and miscredits it to Appendix A. Needs an owner ruling
or a corrected citation.

### Slice 2 — The escrow primitive ✅ SELF-VERIFIED (2026-07-16)

Money held on behalf of a stated mission, released only when verified
humans co-sign that the spend is legitimate. `lib/escrow.ts` +
`ChamberBalance` / `MissionRelease` / `ReleaseAttestation`.

**Chambers, never Circles** (owner ruling, 2026-07-16). `CIRCLES_SPEC`
Principle 4 is a ratified hard scope guard — *"Circles list pledges;
they never hold funds... the action layer does not quietly become a
treasury."* An earlier draft of the endowment spec recommended Circles;
the owner's ruling corrected it and **avoided a spec amendment** rather
than requiring one, because `NEURAL_POLLINATOR` §9.1 already gives
Chambers a per-chamber balance. Never add a balance to a Circle.

**Source-agnostic by construction.** The escrow does not know whether
its balance came from donations (§9.1 — Slice 3, the only source 8.7
ships), an endowment distribution (unratified, Phase-9-real), or a
bounty (§6.2, greenlit). `creditMissionBalance(sourceKind)` exists so
those arrive as adapters, never rewrites.

**Release and freeze are AUTOMATIC (FUND_INTEGRITY §3.7).** Reaching the
threshold pays out **in the same transaction that latches the final
attestation** — `attestRelease` both attests and pays, deliberately:
splitting them would create the discretionary gap the spec forbids.
`freezeChamberReleases(tx, …)` takes a `tx` so it executes inside the
ruling's own transaction. No operator step exists to withhold a valid
release, and none to freeze funds someone doesn't want paid — **both
directions matter**, and the withholding half was unaudited until §3.7
named it. The guarantee is the ABSENCE of the path (ADMIN_OPS §1).

**Guards that earned their place:**
- **No self-attestation.** The proposer's voice never counts toward the
  threshold — CIRCLES_SPEC's reason verbatim: a floor of 2 exists "so
  'attested' always means more than one voice."
- **Open proposals commit the balance.** Two releases that each fit but
  together overdraw would otherwise both reach threshold and pay.
- **Balance re-checked at payment time**, not just at proposal.
- **Purpose frozen at proposal** — the claim being attested must not
  move after signatures land on it.

**★ The tests caught MY misunderstanding, not a code bug.** I wrote the
first tests assuming threshold 2 = proposer + 1 co-signer. It is **2
co-signers** — the Circle rule carried over exactly (the author is
separate; the threshold counts attestations). So a release needs **three
distinct humans**. The code was right; the test was wrong. Rewritten
with a dedicated mission chamber and 3 members so no other test's open
proposals can pollute a balance assertion.

**An existing check caught the rest:** `mission.release` tripped
verify's UNCATEGORIZED FLOW guard until mapped in `lib/transparency.ts`
— classed as *"chamber funds, attested — treasury is not a party"* and
deliberately **not** a treasury outflow: it carries no budget category,
because conflating the two would inflate every utilization figure with
money the treasury never spent. The hardening suite also caught schema
drift (the two schemas must be byte-identical) and the missing
consolidated-migration tables.

**⚠ THE FREEZE HAS NO TRIGGER YET — flagged, not invented
(DECISIONS_PENDING #17).** §3.4 assumes "an upheld Tribunal ruling of
misuse" but never says how the case starts, and two things are
genuinely unanswered: **(a)** a release cannot be flagged at all — `Flag`
accepts `postId` XOR `dmExcerptId`, and a release is neither; **(b)**
which rule is "misuse" (R3.4 Fraud is closest; R2.7 Attested-action
fraud is the perfect analogue but says "*Circle* action"). Wiring it
wrong either lets fraud walk or **freezes a chamber's funding over a
rude comment**. CLAUDE.md rule 1 governs: where the specs are silent,
flag. The mechanism is built and tested directly; the last wire wants
an owner ruling.

**Evidence:** tests **230/230** (11 new). db:verify ALL CHECKS PASSED.
`npm run db:validate:postgres` — schema valid and model-identical.
Typecheck clean.

**NEXT:** Slice 3 — Chamber Mission Funding donations (§9.1: souls
donate PollCoin toward a chamber's declared mission; genuine transfers,
no auto-return). The escrow already accepts the money; Slice 3 is the
intake plus its surface.

### Slices 3–5 — donations, the funding plan, and the second door ✅ SELF-VERIFIED (2026-07-16)

**Slice 3 — donations (§9.1).** Souls donate PollCoin toward a chamber's
declared mission, straight from the internal balance. **A genuine
transfer, no auto-return** — the mechanic exists *because* the owner
killed its predecessor for the opposite property: auto-returned poll
support-staking was "cheap talk, a costless signal carries no
information" (POLLS §4.8, retired). So the tests prove the cost is real:
the donor's balance drops for good, and withdrawing the raising
declaration stops NEW donations while never clawing back given money — a
chamber that could un-declare its way out of accountability would make
"no auto-return" a lie. Gate-cleared like every write (rule 3). Two
inferences flagged in DECISIONS_PENDING #18 (who may declare; no fee on
giving), plus one deliberate omission: donations don't accrue, because
TOKENOMICS §4 doesn't name them and give→accrue→give is a loop worth
auditing before it exists.

**Slice 4 — the funding plan (FUND_INTEGRITY §3.1, Tier 0).** A chamber
cannot ask for money without answering three things: who is funded, how a
donor can check that, what the money buys. **Tier 0 isn't a gate bolted
onto Chambers — it IS what a Chamber already is**; the scaffold and the
public workshop are the dissection, and these three only point that
machinery at money. Plans are revisable (the workshop's job is making the
creator fill the gaps the community finds), but `ChamberFundingRevision`
keeps **every** version from v1: souls donate against a specific plan, so
silent post-hoc edits would be a bait-and-switch with no evidence left.
The history makes that impossible rather than merely forbidden.

**Slice 5 — the second door (§9.1's binding vote).** *"Above a size
threshold... a binding stewardship-style poll authorizes it — members
vote, auto-executes on passage."* Two co-signers are corroboration for a
reimbursement; they are **not** a mandate for the mission's whole purse.
- **§9.1 called this "reusing Circle machinery already built" — it
  wasn't.** Polls knew only Circles. Slice 5 extends the same shape
  (`Poll.chamberRef` / `chamberAction`, `visibilityScope: "chamber"`,
  member-restricted ballots, execute-at-close) rather than inventing a
  parallel one, which is what §9.1 actually asked for.
- **One payment path.** Both doors land in `payRelease()` — two payment
  paths would be two chances to diverge. The ledger records which door
  authorized it (`via: "attestation" | "binding-vote"`).
- The route is decided and **published at proposal**, never chosen after
  the fact; attesting a large release is refused outright, at both
  proposal and attestation, so a rail change can't strand one on the
  cheap path.
- A vote can **lapse**: if a ruling froze the release while the vote ran,
  frozen wins — due process outranks a vote that started before the facts
  were known.
- Rails: `chamber.releaseThreshold` (2, [2,8]) and
  `chamber.releaseBindingVoteThreshold` (25u — verified against
  ECONOMIC_STARTING_DEFAULTS: Circle creation and appeal deposit are both
  25u).

**★ Two divergences the specs carry, recorded not silently resolved:**
1. **FUND_INTEGRITY §3.3 vs §9.1 at the same 25u threshold.** §3.3
   (draft) says a large request must be *staged into ≥2 tranches*; §9.1
   (ratified 2026-07-13) says it needs a *binding vote*. **§9.1 is
   ratified law and won.** §3.3's staging is designed for endowment
   distributions, which don't exist and are unratified.
2. **The rail already had an 8.** `circle.attestationThreshold` ships
   `boundMax: 8` in code, while Appendix A reads "floor 2" with no
   ceiling. So §9.1's "matching the ratified Circle attestation numbers"
   matched the *built rail*, not the Constitution. The correction stands
   (Appendix A is the ratified source), but the 8 wasn't invented from
   nothing.

**★ The tests caught two more of my own errors, not the code's:** I
closed polls without time-travelling the ballots, so the candle correctly
counted every vote as late (`no-consensus`) — the rule working, not
failing. And I snapshotted the recipient's balance before they cast their
own vote, which moved it by 0.75 (fee out, accrual in).

**Evidence:** tests **248/248** (18 new across the three slices).
db:verify ALL CHECKS PASSED. Postgres schema valid and model-identical.
Typecheck clean.

**NEXT:** Slice 6 (Tier 4 — Fund Auditors, Sentinel extension,
transparency category) and Slice 7 (the demo runbook). Still open:
DECISIONS_PENDING #17 (the freeze trigger — mechanism built, wire absent
by design) and #18.

### Slices 6–7 — the audit tier and THE OWNER'S DEMO RUNBOOK ✅ SELF-VERIFIED (2026-07-16)

**Slice 6 — Fund Auditors** (details in the commit; the two properties
that matter: **paid per case, never per finding** — clean and concern
earn identically, because an auditor paid for finding problems will find
problems; and **a finding is a signal, never a penalty** — an auditor who
could freeze money would be an operator with extra steps). Sentinel's
mission watch flags self-dealing *patterns*, never a single
reimbursement, and says on its face that it is "a question, not an
accusation." Numbers are build-time defaults, flagged (#19).

---

## ★ THE OWNER'S RUNBOOK — Phase 8.7 demo

**One command, ten steps, ~15 seconds. Run it from your own terminal.**

```
cd /Users/shawn/Documents/Claude/Projects/Agoranetv3/platform
npm run db:seed        # only if the rails are stale — it's idempotent
npm run demo:phase8.7
```

**What you are showing, in one sentence:** *our treasury's spending half
is one auditable mechanism, and the first thing we pointed it at was the
hardest case — money leaving toward a stated purpose.*

**The four moments to slow down on:**

1. **Step 1 — the guardrail that had no code.** The Constitution has
   said "the treasury MUST NOT spend outside budgeted categories" since
   2026-07-07, and the Treasury Dashboard spec promised it was "rendered
   structurally." It wasn't. There was no category model, no field, and
   no shared door. **This phase made a constitutional guardrail true for
   the first time** — and the check caught a fourth treasury outflow the
   audit had missed on its first run.

2. **Step 5 — the money moves in the same instant as the second
   signature.** Not "then an admin approves." There is no approve step.
   The code path does not exist — for anyone, including you. Say the
   sentence that makes it land: *an operator who can silently sit on
   approved money is as much a capture vector as one who can steal it,
   and nobody audits for that one.*

3. **Step 7 — the honest limit, stated out loud.** You **cannot** claw
   back what is spent. Freeze stops what has not moved. Overselling this
   is the easiest lie in the demo, and refusing to tell it is worth more
   than the feature.

4. **Step 10 — the punchline.** Every event above sits on a ledger whose
   head hash is witnessed by a public Cardano preprod transaction. The
   demo prints the tx. **A reader can verify it against a chain you do
   not control.** Then the real point: *none of this was invented for
   fund integrity. Chambers, attestation, polls, the Tribunal, Sentinel,
   the ledger, the anchor — all of it already ran. This is composition.
   That's the claim that can't be faked, and it's why three attempts
   mattered.*

**If asked "is the money real?" — no, and say so first.** Internal points
with no value. The mechanism is what's real; Phase 9 changes the value,
not the machinery. Same posture as the interim issuer at 8.6.

**If asked "so you can guarantee the money is well spent?" — no.**
Attestation proves N verified humans staked their names, permanently. It
never proves the platform verified the spend. Fund Integrity raises the
cost of lying; it does not make lying impossible. That sentence is in
the product, not just the runbook.

**Known gap, if it comes up (DECISIONS_PENDING #17):** the freeze
mechanism is built and tested, but has no *trigger* — a release cannot
be flagged today (Flag takes postId XOR dmExcerptId), and the spec never
names which rule is "misuse." Wiring it wrong would either let fraud walk
or freeze a chamber's funding over a rude comment. It waits for a ruling
rather than a guess.

**Evidence:** tests **255/255**. db:verify ALL CHECKS PASSED. Postgres
schema valid and model-identical. `npm run check` exit 0. Demo verified
end-to-end on the dev database, closing on a real preprod anchor tx.

**PHASE 8.7 BUILD-HALF COMPLETE — the checkpoint is YOUR run of the
runbook above.** Open for your ruling: #17 (freeze trigger), #18
(donation inferences), #19 (auditor numbers).

### ★ POST-BUILD AUDIT (2026-07-16) — three real bugs, found and fixed

Owner asked for one last review before moving on. **It was worth it: the
audit found three real bugs the slice tests missed, all from one root.**

**The root:** the freeze wiring added a THIRD evidence type
(`Flag.releaseId` / `ModCase.releaseId`, joining a post and a DM
excerpt). Three shared moderation paths still knew only two — and none
of them were exercised, because the slice tests called `resolveCase()`
directly and **never walked the road a real moderator walks.**

| Bug | Effect |
|---|---|
| `caseFileFor()` fell through to `dmExcerptId!` | **A moderator could not open a release case — it threw.** The freeze was unreachable in practice. |
| `appealCase()` copied postId + dmExcerptId only | An appealed release case had **NO evidence pointer** → db:verify's own evidence-shape check would fail it. |
| Strike-ladder Tribunal docket, same omission | Same. Its comment even claimed it carried evidence "whichever kind" — which had become a lie. |

**Fixed and now tested by walking the whole road:** file a report → open
the case file (asserting the triangle still holds: no handles, no ids) →
resolve → appeal → assert the appeal carries the evidence → db:verify.
The case file for a release renders the payment's own claim (purpose,
amount, co-signer count, auditor findings) — all already public on the
ledger, so it reveals nothing new.

**Also corrected — comments that had stopped being true.** `fundAudit.ts`
and `escrow.ts` both said a concern/pattern "has nowhere to go
(DECISIONS_PENDING #17)". #17 is resolved; the road exists. The ledger
events themselves were already accurate ("consequences travel due
process") — only the prose lied. Now they say the sharper truth: the road
exists, but **neither the auditor nor Sentinel walks it** — a detector
that opens its own cases is a machine accusing people, and a human must
decide to file.

`PHASE_8_7_SPEC.md` corrected from "DRAFT, not built" to as-built, with
its §8 closed and the three things the spec did not anticipate recorded
(§9.1's "reusing Circle machinery" was wrong; §3.3's staging lost to
§9.1's binding vote; this audit's three bugs).

**THE LESSON, worth more than the fixes:** unit-testing a mechanism is
not the same as testing the road users take to reach it. Every one of
these bugs sat behind a function the slice tests bypassed.

**Evidence:** tests **262/262** (3 new, all walking the full road).
db:verify green. Postgres parity valid. `npm run check` exit 0. Demo
re-verified end-to-end after the freeze wiring.

---

## On-Chain Economy Migration — Track 1 (ONCHAIN_ECONOMY_MIGRATION.md)

*The parallel track: testnet-only, additive, no production. The internal
double-entry economy remains the system of record. This work does NOT
replace the two venture gates — the legal conversation (securities
classification) and the demand test.*

### Slice 1 — Aiken workspace + tested release primitive ✅ (2026-07-18, 71d26b9)

`infra/onchain/` stood up (Aiken, Plutus v3, stdlib v3.1.0). The seed of
the release authority as pure, unit-tested logic in
`lib/agoranet/treasury.ak`: `signed_by` / `count_signed` /
`threshold_met` — the mathematical form of attestRelease's "N members
co-signed → release," where the validator, not an operator, decides.

**Evidence:** `aiken check` 5/5 green (signer_present, signer_absent,
counts_only_authorised_signers, threshold_met_at_two_of_three,
threshold_not_met_below). Toolchain note: run via
`npx --yes @aiken-lang/aiken` (Homebrew tap-trust broken on this
machine); compile diagnostics render only in a real TTY.

### Slice 2 — CIP-30 self-custody proof ✅ OWNER-PERFORMED 2026-07-18 (128db49)

**The checkpoint, achieved at the owner's keyboard:** his own Lace
wallet signed a preprod transaction the app built — a ~2 tADA self-send
carrying a CIP-20 note (label 674), built in the browser from the
wallet's own UTxOs, signed and submitted by the wallet. The platform
held no key, submitted nothing, and possessed nothing at any moment —
the non-custodial pattern every real flow will follow.

**The proof tx:**
`96893e34169a51526eb5d10d0f91a10ff61faabe72da38fbd425078120161539`
(preprod block 4,951,560; fee 0.172321 tADA; metadata label 674 =
"AgoraNet slice-2 self-custody proof (testnet)"). Independently
re-confirmed via Blockfrost after recording. Publicly verifiable:
https://preprod.cardanoscan.io/transaction/96893e34169a51526eb5d10d0f91a10ff61faabe72da38fbd425078120161539

**The enforced gotcha:** CIP-30 reports networkId 0 for BOTH Cardano
testnets, so the app cannot tell preprod from preview client-side. The
server therefore refuses to record a proof hash until Blockfrost
confirms it exists on the CONFIGURED testnet — the 8.6 "Eternl was on
Preview" incident, promoted from footnote to invariant.

**What was built (additive only):** two nullable columns on
`TestnetWalletLink` (`proofTxHash`, `proofAt`; both schemas
byte-identical + postgres migration), `recordSelfCustodyProof` /
`txExistsOnConfiguredTestnet` in `lib/chain.ts` (verifier injectable for
tests), `submitSelfCustodyProof` server action (returns a result for
client polling instead of redirecting), `components/SelfCustodySign.tsx`
(browser-side build/sign/submit + poll), and the `/settings` proof
section. The browser path never touches `TESTNET_MINT_MNEMONIC` — the
script wallet and the soul's wallet stay separate worlds.

**Evidence:** tests 281/281 (5 new: malformed-hash refusal without a
chain call, no-link refusal, unverified-hash NOT recorded + retryable
with the wrong-testnet hint, verified proof recorded lowercase,
re-signing updates in place). `npm run check` exit 0 (tsc, build,
postgres parity). Live verifier check: found the real 8.6 anchor tx on
preprod, rejected a bogus hash. Browser walkthrough: section renders;
without a wallet extension the flow fails safe ("nothing left your
wallet and nothing was recorded"), zero console errors.

**Owner walkthrough findings (both fixed same-session):** (1) "Reconnect
below to update it" pointed at no visible control — now names the
Connect Lace button; (2) the post-link flash said only "Testnet wallet
linked to this face" while the rail section showed the address — the
flash now echoes the address it linked.

**NEXT:** Slice 3 — simplest non-custodial donation to a script on
preprod (Mesh vesting lock pattern). Open decisions still owed by the
owner before Track 2: the initial M-of-N signer set; the freeze trust
model.

### Slice 3 — the non-custodial donation lock: BUILD + ROUNDTRIP SELF-VERIFIED 2026-07-18, awaiting the owner's donation

**The validator (the real new ground):** `infra/onchain/` gains
`lib/agoranet/donation.ak` + `validators/donation.ak` — the Mesh
vesting lock pattern adapted as our own Aiken code, Slice 1 style (pure
tested rule, thin validator). The rule: funds leave the script ONLY if
the beneficiary signed AND the transaction's validity range provably
starts at/after the unlock time; an unbounded validity start proves
nothing and is refused. `aiken check` 10/10 (5 new); blueprint
committed (plutus.json); script address derived from the blueprint at
runtime — `addr_test1wrdsgwqf7wtpfl2j03gced2wyj8fcr64ksl7qallaf65rkcvwmfcp`
on preprod. Everything downstream reads the blueprint: no copy-pasted
addresses to drift.

**THE ROUNDTRIP, PROVEN LIVE ON PREPROD (dev wallet as donor AND
beneficiary):**
- DONATE `7292911af3a6d64feb028702dfa18cc76fac9135eeee8012bc5ce37f69aa0454`
  — 3 tADA locked at the script with the inline datum (beneficiary,
  unlock).
- EARLY COLLECT REFUSED **BY THE PLUTUS SCRIPT ITSELF** — a
  structurally valid, node-acceptable transaction whose validity
  started before the unlock: `PlutusFailure`, phase-2. The refusal is
  the validator's judgment, not a plumbing error — the negative proof
  that matters.
- COLLECT `04fc80e23109c29e8c795b4ba533a6d85d35041681f05b25e1c38a701fba3ac4`
  — after the chain's own clock passed the unlock slot: accepted, paid
  to the beneficiary.
The lock is real in both directions: refuses early, releases after.
Runbook: `npx tsx scripts/chain/demo-donation-roundtrip.ts [lockSeconds]`.

**App side (additive):** `TestnetDonation` model (both schemas
byte-identical; consolidated into the postgres 0_init per the
house convention — pre-deployment history is rewritten, not appended);
`recordScriptDonation` verifies not just "the tx exists" but **"value
actually sits at the script in that tx's outputs"** before recording
(Blockfrost /txs/{hash}/utxos; wrong-tx → refused outright, not-found →
retryable with the Preview hint); rails `onchain.demoDonationLovelace`
(3 tADA) + `onchain.demoLockMinutes` (10) — the demo's numbers are
data, like every number; `submitScriptDonation` action (script address
resolved SERVER-side from the blueprint — a tampered browser can't
point verification at a different script); `DonateToScript` component
(browser-built from the wallet's own UTxOs, wallet-signed,
wallet-submitted, then polls); the `/settings` donation section with
the honest-shape disclosure (demo beneficiary = dev wallet; M-of-N
replaces it in Track 2). Env: `TESTNET_DEMO_BENEFICIARY_ADDR` (an
address, public by nature — never a key).

**Evidence:** tests 287/287 (6 new donation tests: malformed-hash
refusal without a chain call, no-link refusal, not-found retryable,
zero-at-script refused outright, chain-verified amount recorded,
idempotent per hash). `npm run check` exit 0. aiken 10/10. Browser
walkthrough: section renders with the blueprint-derived address;
without a wallet the flow fails safe; zero console errors.

**Toolchain gotchas, learned by four live attempts (Track 2 will need
every one of these):**
1. `aiken check` piped shows NOTHING on compile errors AND `$?` after a
   pipe is the pipe's — run under `script -q /dev/null` (pseudo-TTY) to
   capture diagnostics, or parse the JSON from stdout.
2. Validator names must not collide with imported module names
   (`validator donation` vs `use agoranet/donation` → duplicate name).
3. Mesh's legacy `Transaction` wrapper mis-serializes script-spend txs
   (3-element pre-Alonzo CBOR → node `DeserialiseFailure`). Script
   spends use **MeshTxBuilder** (the shape of Mesh's own vesting
   example): spendingPlutusScriptV3 → txIn → txInInlineDatumPresent →
   txInRedeemerValue → txInScript → txOut → txInCollateral →
   invalidBefore → requiredSignerHash → changeAddress → selectUtxosFrom.
4. ALWAYS build with live protocol params (fetcher: BlockfrostProvider)
   — stale local cost models fail `ScriptIntegrityHashMismatch` at the
   node. Post-van-Rossem (PV11, mainnet 2026-07-18) this matters more,
   not less: cost models just changed.
5. Mesh's local ms→slot mapping drifts tens of seconds from the node.
   Never gate submission on wallclock — poll Blockfrost /blocks/latest
   until the chain itself passes the validity-start slot.
6. Collateral: a script spend needs a pure-ADA UTxO; the wallet
   consolidates into one token-carrying UTxO, so provision collateral
   (5 tADA self-send) — and do it AFTER the donate leg, whose coin
   selection will otherwise spend it.

**Known residue, deliberate:** the failed attempts left 4×3 tADA of
matured, collectable UTxOs at the script (the collect leg proved they
are recoverable — the beneficiary can sweep them any time). Testnet
faucet money; left as-is.

**THE CHECKPOINT (owner at the keyboard, ~2 minutes):** donate from HIS
Lace via /settings — funds provably leave his wallet for the script,
platform never in possession; the recorded tx hash + Cardanoscan link
is the record. The collect side is already proven above and is NOT his
checkpoint.

**★ SLICE 3 CHECKPOINT — OWNER-PERFORMED 2026-07-18 (his evening).**
The owner donated from HIS OWN Lace via /settings:
`a4ce03324a0465f067104532f6e35e9fc329113cf20688b388dd147ce09e31bb`
— 3 tADA from his wallet to the donation-lock script, inline datum
attached, change back to him, platform never in possession. Verified
on-chain (Blockfrost: 3,000,000 lovelace at the script in that tx's
outputs) and recorded through `recordScriptDonation`'s
verify-then-record path. Publicly verifiable:
https://preprod.cardanoscan.io/transaction/a4ce03324a0465f067104532f6e35e9fc329113cf20688b388dd147ce09e31bb
One wrinkle, honestly recorded: the page's own polling didn't write the
row (he moved on while it was still confirming); the idempotent record
path closed it from the chain's evidence — which is the design working,
not luck: the chain is the source of truth, the row just mirrors it.
**Slice 3 of ONCHAIN_ECONOMY_MIGRATION.md is COMPLETE. Next: Slice 4
(toy M-of-N release, Anastasia upgradable-multisig) — plus the two
open decisions owed before Track 2 (initial signer set; freeze trust
model). Track 2 design must start from ONCHAIN_DESIGN_PATTERNS.md
(corpus) per OPEN_ITEMS_CHECKLIST 43b.**

### Slice 4a — the M-of-N release, our primitives, live on preprod: SELF-VERIFIED 2026-07-18 (evening)

**Owner ruling that shaped it (same evening): "both, ours first."**
Slice 4 split — 4a proves the release authority with OUR tested
primitives now; 4b integrates Anastasia's `aiken-upgradable-multisig`
(the candidate for its real differentiator, UPGRADABLE signer sets)
before Track 2 commits to the dependency. Migration doc amended.

**The validator:** `treasury.ak` gains `ReleaseDatum` +
`release_permitted` (three new tests incl. the crowd test: five
unauthorised signatures satisfy nothing); `validators/release.ak`
wires it to the script context. aiken 13/13; blueprint rebuilt.

**THE ROUNDTRIP, PROVEN LIVE ON PREPROD** (three throwaway signer
keys, never funded — they only sign; the fee-paying dev wallet is
deliberately NOT in the signer set, so "the operator signed" can never
satisfy the rule):
- LOCK `0dabf0bf5caac6e78479c9d195ab7324b3d5c8eadd0cebd1f3f82ce1bd29e550`
  — 3 tADA behind 2-of-3 at
  `addr_test1wr3cy7fn2ueak4f02zlv9ycpjsw35l7sxghcwynm9rnfzps7qr5fn`.
- 1-OF-3 RELEASE **REFUSED BY THE PLUTUS SCRIPT** (phase-2
  PlutusFailure) — below threshold, structurally valid, refused on the
  rule alone.
- 2-OF-3 RELEASE ACCEPTED:
  `7bfd9228dd02887c56cca971f1ad55e88ab8af9bef5052cd61df5916f8e48537`.
This is `attestRelease` — "N members co-signed → release, no operator
step" — as chain mathematics. The Slice 1 primitives, now proven in
anger. Runbook: `npx tsx scripts/chain/demo-multisig-roundtrip.ts`.

**The Slice 3 carry-over, DELIVERED (was a MUST before this
checkpoint):** `lib/chainReconcile.ts` + `npm run chain:reconcile` —
the server mirrors the chain on ITS schedule; no record depends on a
browser tab again. Proven by live drill: the owner's real donation row
was deleted, the sweep RECOVERED it from pure chain evidence
(a4ce0332…, 3,000,000 lovelace), and a second sweep changed nothing
(idempotent; already-recorded txs never re-consult the chain).
Malformed placeholder links skip cleanly (Blockfrost 400 ≠ outage);
real failures still throw. Multisig signing gotcha for 4b/Track 2:
`required_signers` is what the validator reads as extra_signatories —
each named key must witness the tx, and co-signing is sequential
partial signs (`signTx(tx, true)`) accumulating witnesses.

**Evidence:** tests 289/289 (2 new reconciliation tests). `npm run
check` exit 0. aiken 13/13. Live drill + roundtrip above.

**NEXT:** Slice 4b (Anastasia integration, before Track 2 commits) —
then Track 2 design (start from ONCHAIN_DESIGN_PATTERNS.md per
checklist 43b), still gated on the owner's two decisions: initial
signer set; freeze trust model.
