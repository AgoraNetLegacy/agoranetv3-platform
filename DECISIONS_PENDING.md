# The Owner's Queue

**The short version: you have ONE thing to do, a few decisions that
only matter when we aim at the public, and a stack of receipts.**
Most numbered entries below are NOT questions — they are records of
defaults Claude set on your behalf, kept so you can overrule any of
them, anytime, with a sentence. Nothing on this page stops the build;
each entry names what it gates. Blocking questions never live here —
they interrupt directly.

(Numbering is stable — checkpoint records cite these by number — so
items keep their numbers even though they're grouped by what they
need from you.)

---

## A. Needs you now — one thing

14. **Hosting — DECIDED: Render (2026-07-11, in session; Vercel
    considered and set aside — its serverless shape would split the
    ops jobs across three services).** What's left is the part only
    you can do: **create the account at render.com and put a card on
    it** (~US$25–40/mo for staging-grade everything). Then say "done"
    and Claude does the rest in one sitting — databases, app, cron
    jobs, settings — paint-by-numbers per docs/DEPLOYMENT.md. Gates:
    the Phase 8 checkpoint's real cohort needs a URL to touch.

---

## B. Decisions that wait for PUBLIC launch — nothing here matters for the cohort test

1. **Legal gate check (BUILD_ORDER Phase 4; external track).**
   Internal-only currencies want review-lite, and the non-withdrawable
   Gratium posture should be confirmed with counsel **before any launch
   marketing mentions tokens**. The compliance memo in the corpus
   `Legal/` folder frames it. Gates: launch comms, Phase 9.

15. **Invite mechanics — your launch-gating call (BUILD_ORDER Phase 8:
    "invite mechanics if launch is gated").** Nothing is built,
    deliberately — building an invite system presumes the answer.
    The cohort test does NOT need this: an unlisted staging URL is the
    gate (recruit by link). The real decision is public-launch posture:
    open door vs. invite waves. If you choose gated, say so and the
    invite mechanics get specced against ONBOARDING (the anti-Sybil
    audit lists invite gating as defense-in-depth, not a requirement).

2. **Support staking UI (TOKENOMICS "live at launch").** The poll-page
   "attach a PollCoin support target" surface (POLLS §4.8) isn't built
   yet — auto-return at close is the ratified behavior. Needs a small
   design pass. Gates: launch completeness, not any phase.

3. **AI summaries (DISCUSSIONS §5).** Spec grants them "their own
   mini-review" as the first in-house AI surface. Say when.

4. **Declared interests (ONBOARDING Stage 5.5).** Optional per-persona
   interests + one-time +5 G share bonus — not yet built; the grant
   rail exists. Say when.

18. ~~**The Testnet Track**~~ — **OWNER-RATIFIED (2026-07-12): "build
    this up as much as possible without mention of production… fully
    build this on testnet, with all our bells and whistles."**
    Scheduled as BUILD_ORDER Phases 8.5 (Presentation Era) + 8.6
    (Testnet Rails) by the same-day amendment. His standing rules,
    on the record: production NEVER proceeds without the lawyer
    conversation first; no production talk in any material until
    then; he learns and teaches the REAL platform, not interim
    scaffolding. The cohort checkpoint moves to the showcase build.
    Each phase gates on his ratification of its spec
    (Presentation/PRESENTATION_SPEC.md ·
    Chain Integration/TESTNET_RAILS_SPEC.md).

17. **Key recovery / Alias succession — needs a build slice before
    PUBLIC launch (surfaced 2026-07-11 reviewing onboarding).** The
    spec designed recovery (DUAL_IDENTITY §8: True Self recoverable
    through the issuer; lost Alias = hatch a fee-gated successor,
    Light Score carrying both ways, lineage visible — you ratified
    that as "hatching"), but BUILD_ORDER never scheduled it into a
    phase, so **no recovery UI exists**: today a lost access key or
    credential has no built remedy. Why the cohort test is fine
    anyway: in Phase A the issuer is interim, so a tester who loses
    keys just verifies again as a fresh soul — identity is cheap
    until real Proof-of-Humanity arrives. Why launch is not fine:
    with a real issuer, "start over" stops being possible, and the
    successor-hatch needs revocation machinery (the one-Alias
    nullifier must be re-spendable after revocation — plumbing
    exists: handle tombstones already know "hatched"). Recommend
    scheduling as a small slice after the cohort test. Gates: public
    launch readiness.

---

## C. The record — defaults already set, yours to overrule (not questions)

Read at leisure, or never. A nod is enough; silence is also fine.
Every rail here is adjustable live, and the derived numbers all expire
at the Phase 9 real-money re-review regardless.

5. **Gap numbers DERIVED from the ratified lattice (your directive,
   2026-07-11, "fill in the gaps according to the other numbers") —
   see `DERIVED_DEFAULTS.md` for every derivation:** strike penalties
   5/15 uG (= flag deposit / permanence-fee magnitudes; the §7
   symmetry priced equally on both sides), LS deductions 5/10 ×tier
   (= v2 engine's answer weight / participation cap), Sentinel 5
   flags/24h (= an appeal-deposit's worth of collective stake in one
   day-cycle), poll-closing-soon 6h (¼ day-cycle). Face-switch
   cooldown RESOLVED by you (2026-07-11): none — seamless switching is
   the vision; mechanism retained as a 0–15 min rail. Supervision
   cold-start interim unchanged (a rule, not a number).

6. **Notification categories awaiting host features:** replies-on-join
   (needs join=follow), governance-poll-opened (needs pillar follow),
   DMs (Phase 6.5 — live). The exhaustive-list law is honored; these
   activate with their features.

7. **Phase 6 flags (2026-07-11):**
   - **Domain-level Circle tags** (CIRCLES §2.1): wired at Phase 7 when
     domains became rows. Resolved by the build.
   - **Browse-by-size filter** (CIRCLES §4): member counts displayed,
     recency-of-attested-action orders the browse; an explicit size
     filter is a five-line addition when wanted.
   - **Circle-activity notification scope:** fires on member-joined /
     action-logged / entry-attested / internal-poll-opened, aggregated
     per Circle. Room REPLIES deliberately don't notify —
     NOTIFICATIONS §5 gives ambient followed-thing activity to the
     feed. Confirm the event set feels right in use.
   - **Untagged Circles' rooms/polls homed in the meta pillar**
     (a Discussion/Poll needs a pillar row; access unaffected).
     Cosmetic only.

8. **DM encryption stack — RESOLVED at Phase 6.5 start (2026-07-11;
   OPEN_ITEMS Track 5 #29 is build-time technical):** X25519 → HKDF
   per-thread key → AES-256-GCM per message (Signal-family primitives,
   all industry standard). Phase A: private keys operator-escrowed
   under `DM_MASTER_SECRET` — the exact trust posture as the gate,
   disclosed verbatim in the thread UI; the wallet-side rail cuts over
   at Phase 9 with Lace. Why not a double ratchet now: with a
   server-rendered app and no client key store, ratchet keys would
   live server-side anyway — cryptographic theater. **Re-review
   mandatory at Phase 9** alongside the gate cutover.

9. **Phase 6.5 derived rules (2026-07-11):**
   - ~~**Releasing a bond**~~ — **YOU RATIFIED (2026-07-11, "this
     sounds right"):** either side may withdraw quietly. A bond is
     ongoing mutual consent, not a contract.
   - **DM-conduct strikes land in the meta pillar.** Moderation is
     pillar-scoped by ratified design; DMs have no pillar. The
     alternative (a per-human "conduct" bucket) is forbidden by the
     no-universal-score invariant. Interim until reviewed.
   - **§3's Circle/Chamber invites** await invite mechanics on those
     surfaces (Circles are open-join in v1).

10. **Phase 7 flags (2026-07-11):**
   - **The 16 drafted Opening Questions (Compassion + Hope).** Drafted
     in the ratified style (marked `derived-draft` in data, noted on
     their pages). Ratify or edit at leisure — wording changes are
     ledger-evented amendments, per canon law. The threads are live.
   - **The Agora dashboard is INCLUDED** (the ratified capstone
     provides its content). Trivially revertible to a bare hub view.
   - **Repair acceptance = system-opened governance poll** (consensus
     at the platform bar, sealed + candle, auto-executed at close) —
     the least-inventive assembly of ratified machinery. **Repair
     submission is FREE** (the fee lattice read strictly); one open
     repair per soul per domain is the structural anti-spam.
   - **Repair-outcome notifications deferred** (the category list is
     exhaustive by design; a "repair decided" category awaits your say).
   - **Open-lens weights shipped as derived rails** (contributors ×3 =
     the v2 insightful weight, tippers ×1, sourced ×1, half-life 72h);
     the formula page renders live from the rails, versioned.
   - **Minimal poll cards in the feed** (status changes only — never a
     sealed tally); card rollout order beyond Discussions remains yours.
   - **"system" is tombstoned in the handle namespace.** Consider also
     reserving "agoranet"/"treasury".
   - **Treasury per-category trend charts are v1-thin.** Cosmetic.

11. **Build-time rail defaults, owner-adjustable:** pillar session
   timeout 30 min · alias activation 24–72h/daily cohorts
   (spec-indicative) · candle window 20% of poll duration ·
   display-name cooldown 7 days · handle charset 3–30 `[a-z0-9_-]` ·
   consensus threshold = leading option's share of counted ballots.

12. **Phase 7.5 flags (2026-07-11):**
   - **"Carrying both tokens" = a nonzero balance in each.** The
     refusal message points at the earnable paths. Set a floor rail if
     "carrying" should mean more.
   - **Chamber membership is enclosed-space information** (count
     public, list never — private gate clearances; contrast CIRCLES,
     whose spec makes joins public). chamber.created stays public.
   - **Private-chamber storefront = name + private marker** (§4.3
     "may be minimal"; §10.6 lifecycle remains open).
   - **Invites surface on /pollinator, not as notifications** (a
     chamber-invite category awaits your say — same discipline as the
     repair-outcome deferral).
   - **Workshop permanence upgrades blocked** (the members'-room
     precedent: a public hash-commit of an enclosed draft would leak
     who works inside).
   - **Workshop posts don't feed Light Score** (the room is not the
     record).
   - **Transparency mapping:** fee.chamber → "Creation fees",
     fee.chamber-post → "Reply & vote micro-fees". A dedicated
     "Pollinator" category is a two-line change if you want it.
   - **chamber-activity event set:** soul-entered + scaffold-sharpened
     notify (quiet, aggregated); workshop replies deliberately don't.

13. **Phase 8 analytics flags (2026-07-11):**
   - **Tool selection (OPEN_ITEMS #30) resolved in-house-minimal:** an
     event is a name + timestamp in our own database, NOT a deployed
     Umami/Plausible instance — the ratified constraints are STRICTER
     than those tools' defaults, and one database keeps analytics
     inside the same backup/verify/access discipline as everything
     else. The measured vocabulary is CLOSED (db:verify fails on any
     unaudited event name). Swappable later if richer tooling is wanted.
   - **State of the Commons placement:** its own page at /commons,
     linked from /transparency. Cosmetic; move at will.
   - **The public stat set:** shipped with the spec's proposed list +
     the onboarding funnel table. Final set is your pass when you look.
   - **Funnel nuance:** Phase A's interim issuer verifies instantly, so
     gate/verified fire together until Phase 9's real issuer.
     funnel.alias is count-only — analytics doesn't get what the hatch
     ceremony withholds.
   - **Admin metrics surface:** aggregates are public on /commons;
     raw-event access is operator database access. An in-app admin
     console was never scheduled by BUILD_ORDER — say if you want it
     post-launch.

16. **Early-platform crowd-size honesty (DUAL_IDENTITY §7.2) — built,
    bless the wording:** below 25 active souls (rail), the Alias
    ceremony says plainly that a small crowd thins anonymity, the
    records are still unlinkable, and the note lifts itself as the
    commons grows. §7.2's own directive, surfaced at the exact moment
    it matters. Never blocks hatching.
