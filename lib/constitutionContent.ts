// The AgoraNet Constitution, VERBATIM from the ratified corpus document
// (/Users/shawn/Desktop/Agoranetv3/Platform Constitution/PLATFORM_CONSTITUTION.md).
// Owner walkthrough finding, 2026-07-15: souls acknowledge the Constitution
// at onboarding, so the full text must be readable ON the platform; a
// summary with nowhere to click is a trust gap. This constant renders at
// /constitution (public, signed-out readable; reading is free).
//
// Provenance rule: the corpus document is the source of truth. If the
// owner amends it there, copy it here verbatim (frontmatter stripped) in
// the same change; CHECK 2 of scripts/verify.ts-style honesty applies:
// the platform must never render a stale constitution.

export const CONSTITUTION_MARKDOWN = `

# The AgoraNet Constitution

## Preamble

AgoraNet exists so that good people can find each other, combine what
they know and what they have, and act on real problems together. It
gives every verified human two protected identities; a True Self and an
Alias; and a public square whose records cannot be quietly rewritten.

This constitution has one purpose: to keep that square standing. It is
written for stability and against capture; by wealth, by faction, by
office, or by its own founders. It is deliberately incomplete: it sets
the rails, and it entrusts everything on the rails to the community
this platform was built for, growing in authority as the community
grows in size. The founders wrote this document; the community will
outgrow the founders. That is the intent.

---

## Article I; The Invariants

These seven properties are what AgoraNet *is*. No ordinary vote,
office, emergency, or convenience may set them aside. (Their amendment,
if possible at all, is governed by Article IV, Class 3.)

1. **The public ledger is pseudonym-only.** No internal identifier,
   legal identity, or credential content ever appears in the public
   record.
2. **One human: at most one True Self and one Alias**; and the two
   are structurally unlinkable. The platform must remain *unable* to
   connect them, not merely unwilling.
3. **No universal score exists.** Reputation is per identity and
   per-pillar, never summed, never global.
4. **One profile, one vote.** Voting power never derives from wealth,
   stake, tenure, office, or reputation; and is never delegated. No
   person votes with another's voice.
5. **Powers stay separated.** The body that writes rules (the
   community, by poll) never applies them; the bodies that apply and
   review them (badge holders, the Tribunal) never write them.
6. **The civic record is append-only.** Content leaves the permanent
   record only through due process under published rules; never by
   personal, institutional, or governmental convenience.
7. **Reading is free; acting costs; money never buys outcomes.**
   (Amended by owner, 2026-07-07; the participation-cost rule,
   TOKENOMICS §1.) The read-only tier is free forever: the public
   record is never paywalled. Participation actions carry nominal
   micro-fees; the platform runs on participation, not on ads or the
   sale of user data. Fees must stay genuinely small, every fee-bearing
   civic action must keep an earnable-token path (voice can always be
   earned, wealth only accelerates), service to the platform is never
   charged, and no fee, purchase, or stake ever buys outcome weight.

---

## Article II; The Tenets

Seven principles guiding the interpretation of everything else. Where
this constitution or any rule is ambiguous, read it in their light.

1. **Dignity first** *(Compassion)*; the platform's baseline
   protections are unconditional; no one earns their way into basic
   standing.
2. **Legibility always** *(Hope)*; rules, records, rankings, and
   reasons are visible and explainable. Nothing that shapes a person's
   experience may be a black box.
3. **One set of rules** *(Justice)*; identical treatment regardless
   of wealth, standing, office, or popularity; the powerful get no
   special channel.
4. **Two identities, protected** *(Freedom)*; the dual identity is a
   right, not a feature; protecting it outranks convenience, curiosity,
   and commerce.
5. **Power diffuses** *(Unity)*; authority is brief, random,
   voluntary, and plural. Capturing any organ of this platform must
   remain structurally unprofitable.
6. **Correction over suppression** *(Harmony)*; tension is
   metabolized through due process, not hidden; consequences carry
   redemption paths.
7. **The community inherits** *(The Agora)*; every parameter is a
   rail the community can move; every rule is legislation the
   community can amend; the system is built to be handed over.

---

## Article III; The Community and Its Government

### Section 1; The Community

The community is its verified humans, each present through up to two
identities. Readers; the unverified public; are welcome in every public
space, without account or fee, always.

### Section 2; Rights of Participants

Every verified profile holds, without qualification:

1. The right to participate once verified; and to a vote that counts
   exactly once.
2. The right to due process: no penalty without a cited rule, no
   removal without a recorded ruling, and one appeal of any ruling.
3. The right to the other identity's privacy; no process of this
   platform, including moderation and governance, may require or
   attempt linkage of a person's two identities.
4. The right to dissent: lawful, rule-compliant speech is never
   penalized for its viewpoint; including criticism of the platform,
   its founders, and its officers.
5. The right to leave: account deletion on request, subject only to
   the permanence of what was knowingly written into permanent spaces
   (Decision 1, consented at composition).

### Section 3; The Legislature: Governance by Poll

The community writes its own law. Rules, the rulebook, and every
guardrail parameter are changed only by governance poll; sealed
tallies, candle close, current proof of humanity, one profile one
vote, held in the permanent Governance rooms. Statute-level detail:
\`POLLS_SPEC.md\`.

### Section 4; The Adjudicators: The Badge

Rules are applied by randomly selected, freely consenting, briefly
serving community members; 48-hour badges, conflict-excluded,
pseudonymously accountable, compensated from the treasury. Badge
holders find facts against cited rules; consequences apply
automatically by published ladder. Statute-level detail:
\`MODERATION_SPEC.md\` and the Content Moderation Rulebook.

### Section 5; The Tribunal

Seven members, drawn by lot from experienced badge-completers, serving
staggered 30-day terms, never consecutively, paid by the treasury.
The Tribunal:

1. Hears appeals and escalations, and alone imposes suspensions and
   bans;
2. **Reviews constitutionality**: a passed Class 2 amendment (Article
   IV) takes effect only after the Tribunal affirms, with published
   reasoning, that it violates no Invariant;
3. Is subject to **no confidence**: the community may, by governance
   poll, dissolve a sitting Tribunal and trigger a full re-draw;
4. Holds no immunity; its members answer to the same rules as
   everyone, and abuse of office is a severe infraction;
5. **May void a corrupted poll on process grounds only** (Sybil
   flooding, bribery, procedure violations) and order a re-run; it
   may **never** reverse a poll's outcome and substitute its own
   (added by owner ratification, 2026-07-09: the community's
   legislative voice always outranks the judiciary on what the rules
   are; the Tribunal only answers whether the rules were followed);
6. Decides by **simple majority (4/7)** on appeals, **supermajority
   (5/7)** to overturn a severe-tier ruling or void a poll (owner,
   2026-07-09).

### Section 6; The Treasury

All platform fees and penalties flow to the treasury. The treasury is
publicly inspectable at all times, spends only through periodic
community budget polls and constitutionally authorized categories, and
its first standing obligation is compensating the community's own
moderation service.

---

### Section 7; The Council of Pillar Stones & The Keystone
*(added by owner ratification, 2026-07-09; the concrete form of
Tenet 7; full design: \`Keystone/KEYSTONE_HARMONIZATION_SPEC.md\`)*

The founders' authority is temporary by design, and this section is
its sunset. Over seven years, forty-nine **Pillar Stones**; soulbound,
non-transferable seats, seven per pillar; are awarded to the
platform's proven pillar leaders: role models, educators, and active
stewards of each pillar's community, selected by sustained pillar
standing, never by wealth or election.

1. **The Council of 49 inherits the founder's power; never the
   community's.** Governance by poll (Section 3) remains supreme and
   is never delegated. The Council receives, on the published
   schedule: admin ratification and oversight, operator
   accountability, and the platform-entity voice.
2. **One stone per human**, enforced blind through the same
   cryptographic pattern that guarantees one True Self and one Alias
; no linkage, no exception. An Alias of proven standing may hold a
   stone.
3. **Terms rotate:** seven-year terms, staggered so seven seats renew
   each year thereafter; seven-year cooling-off; inactivity forfeits
   the seat by published ladder. No permanent aristocracy.
4. **Removal for cause** requires 75% of the Council and carries one
   appeal to the Tribunal; Council members answer to the same rules
   as everyone.
5. **Stewardship is compensated by treasury stipend, never by profit
   share**; seats carry duty and honor, not dividends.
6. **The Keystone** manifests when all forty-nine stones are seated,
   the seventh year completes, and the community votes to finalize
   the transition. Its holder; the founder, then any Guardian the
   Council elects in succession; is one voice among fifty, bearing
   **one unconditional veto, ever**, as an emergency brake against
   capture; any later veto requires 80% community approval. Every
   veto is public, reasoned, and permanently archived.

## Article IV; Amendment

Three classes, three bars. This article is also the handover: it is
how the community may, over time, revise; or one day wholly
re-author; this document.

| Class | What | Bar (shipped defaults; Class 1 within Appendix bounds) |
|---|---|---|
| **1; Guardrail parameters** | Any dial in Appendix A | Ordinary governance poll, within the Appendix's stated bounds |
| **2; Constitutional text** | Tenets, Article III structure, this table's defaults | Supermajority (67%) of votes cast + minimum participation quorum + 30-day deliberation window + Tribunal constitutionality review |
| **3; The Invariants** | Article I | **Ratified (owner, 2026-07-07):** an extreme bar; 90% supermajority + high quorum + 90-day deliberation + the platform's one **per-human** vote (each human votes once, regardless of identities), reserved for exactly this and nothing else. Even bedrock keeps an emergency exit; the exit is nearly impossible to use |

No amendment of any class may take effect retroactively, and none may
target an identifiable person or case (rules are general or they are
not rules).

---

## Appendix A; The Guardrails

Every community-adjustable parameter, its shipped default, and its
bounds. Class 1 amendments move values within bounds; changing a bound
itself is Class 2. (Consolidated from the ratified specs; the build's
single source of truth for defaults.)

### Must-guardrails (not parameters; standing prohibitions)

- Reading **must** remain free; the public record is never paywalled
  (Invariant 7, as amended 2026-07-07).
- Fee amounts **must** stay nominal; never high enough to price out a
  participating human; every fee-bearing civic action **must** keep an
  earnable-token path (Invariant 7; Tokenomics participation-cost
  rule). Flag deposits **must** refund on upheld and good-faith
  declined flags.
- The treasury **must not** spend outside budgeted categories.
- No parameter change **may** create vote weighting, delegation, or
  identity linkage (Invariants 2, 4).

### Adjustable dials

| System | Parameter | Shipped default | Bounds |
|---|---|---|---|
| Moderation | Badge term | 48h | 24–96h |
| Moderation | Offer-accept window | 12h | 6–48h |
| Moderation | Badge cooldown | 7 days | 2–30 days |
| Moderation | Active strikes | 3 | 2–5 |
| Moderation | Strike / score-deduction decay | 6 months | 3–24 months |
| Moderation | Tribunal size | 7 | 5–9, odd |
| Moderation | Tribunal term | 30 days | 14–90 days |
| Discussions | Edit grace window | 15 min | 5–60 min |
| Discussions | Attestation threshold (Circles) | 2 co-signers | floor 2 |
| Circles | Member-removal poll bar | Consensus-type | floor: simple majority |
| Polls | Consensus threshold default | 60% | 51–80% |
| Polls | Candle-close window | final segment | bounded by poll duration |
| Identity | PoH freshness, ordinary | 12 months | 6–24 months |
| Identity | PoH freshness, governance | 6 months | 3–12 months |
| Economy | All fee/reward/stipend amounts | per Tokenomics | within must-guardrails above |
| Amendment | Class 2 bar | 67% + quorum + 30 days | floor: 60% / may only be raised by Class 2 itself |

---

## Ratification & Anchoring

This draft becomes the founding constitution upon owner ratification.
At platform launch it is hashed and anchored on-chain; permanent,
timestamped, tamper-evident; and presented to every new participant
at onboarding (Stage 4.2) before their first post. Every subsequent
amended version is anchored likewise: one continuous, verifiable
constitutional record from the first day.
`;
