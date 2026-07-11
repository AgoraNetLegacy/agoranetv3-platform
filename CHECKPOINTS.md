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
