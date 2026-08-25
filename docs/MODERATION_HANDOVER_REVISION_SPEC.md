# Moderation Handover Revision; Constitutional Fallback and Community Transition

**Status:** Draft working specification; not ratified and not production law  
**Prepared:** 2026-08-25  
**Purpose:** Provide a reviewable plan for revising AgoraNet's existing moderation design to handle cold start, community transition, and later pool decline without creating either unchecked founder power or an impossible moderation backlog.

## 1. Decision summary

AgoraNet should retain the useful mechanics of the proposed Moderation Handover draft:

- moderation begins with a disclosed interim bench because the launch pool cannot support anonymous sortition;
- community participation expands through measured stages rather than a calendar;
- pool health measures actual conflict-free, recently willing participants rather than total accounts;
- moderation capability can throttle when the pool is too small;
- severe and imminent-harm cases retain a designated operations-and-counsel path;
- handover state is publicly auditable and, where practical, enforced by a monotonic on-chain state transition.

The central principle is revised.

> A pool shortage must never restore unchecked or discretionary founder control. A constitutional, rule-bound fallback may perform moderation when necessary, provided it is temporary or reviewable, recused, auditable, transparent, appealable, and unable to change the rules or expand its own authority.

This is a refinement, not a rejection of community governance. Moderation carried out by the founder or designated staff under the Constitution and community-ratified rules is administration of delegated authority; it is not equivalent to unilateral founder power.

## 2. Scope and non-goals

This specification changes the moderation handover and continuity model. It does not replace the existing moderation rules, severity taxonomy, badge lifecycle, evidence rules, criminal protocol, appeals principles, or constitutional rights unless an amendment is explicitly approved.

It covers:

1. launch moderation and the interim bench;
2. staged transfer of routine and heavy-case authority to community sortition;
3. measuring draw-pool health and anonymity capacity;
4. throttling when the available pool is too small;
5. a constitutional fallback for continuity;
6. Tribunal seat conversion;
7. on-chain/public audit requirements;
8. edits required in the existing moderation implementation and documentation.

It does not yet finalize the numerical rails, the identity-nullifier closure policy, or the Phase B zero-knowledge proof system. Those remain explicit decisions before ratification.

## 3. The problem

The existing sortition design assumes that enough qualified and active profiles exist to staff moderation and Tribunal seats. That assumption fails at launch and can fail again after a period of community decline.

The failure is not only throughput. A small draw pool can reveal who is judging a case, make conflict exclusions eliminate nearly everyone, and allow the accused to infer the likely moderator. Therefore, community moderation must not activate merely because the platform has reached a calendar date or a nominal user count.

At the same time, a pool shortage should not force AgoraNet to choose between indefinite ordinary-case queues and unchecked founder discretion. The system needs a third option: a constrained constitutional fallback.

## 4. Governing model: authority, capability, and fallback

### 4.1 Authority

Authority means who may issue a moderation decision under the current governance model.

Authority progresses through the handover stages, but no individual operator may unilaterally expand, reclaim, or redefine it.

### 4.2 Capability

Capability means which case forms the current system can safely process given the live draw pool.

Capability may move in either direction. It can increase when the pool becomes healthy and decrease when participants leave, become inactive, or become conflict-excluded.

Capability reduction does not automatically restore discretionary founder control.

### 4.3 Constitutional fallback

When ordinary moderation cannot be staffed safely, the fallback may be used only within a published constitutional mandate.

Fallback authority must satisfy all of the following:

- **Rule-bound:** it applies existing ratified rules and cannot invent new standards.
- **Narrow:** it handles only the case classes and actions explicitly permitted by the fallback rail.
- **Recused:** the fallback actor cannot decide cases involving their own content, interests, relationships, or prior actions.
- **Audited:** every decision records the rule cited, evidence basis, actor role, timestamp, and review state.
- **Appealable:** affected users retain the published appeal path; a fallback decision cannot be its own final appeal.
- **Time-limited or reviewable:** the fallback is periodically reviewed and can be changed only through the authorized governance path.
- **Non-expansive:** the fallback actor cannot change the Constitution, moderation rails, pool thresholds, or their own appointment.
- **Transparent:** the public dashboard reports when fallback authority is active, what case classes it covers, and how many cases it has handled.

The fallback may be founder-operated during early bootstrap if the owner accepts that disclosed role, but it must not be a private owner override.

## 5. Handover stages

The following stages replace the overly simple “founder authority disappears and can never return” interpretation.

| Stage | Routine cases | Heavy cases | Severe / imminent harm | Fallback role |
|---|---|---|---|---|
| S0; Founding Bench | One named, audited operations lead; second review when available | Two-reviewer interim bench | Operations and counsel | Primary moderation path |
| S1; Supervised Community | Community holder with fallback second review | Bench or authorized fallback with community observer where safe | Operations and counsel | Supervisor and continuity path |
| S2; Community Routine | Community sortition | Three-holder community majority when pool permits | Tribunal or operations/counsel | Residual, disclosed fallback only |
| S3; Full Sortition | Community sortition | Community majority | Community Tribunal plus permanent operations/counsel lane | Dormant unless constitutionally reactivated |

Stage transitions require measured pool health sustained across the defined number of anchor periods. A calendar may be used for term rotation or review cadence, but not as the sole trigger for handing over authority.

## 6. Pool health and anonymity capacity

For case `c`, define the conflict-free willing draw set as:

```text
D(c) = verified profiles
       minus case conflicts
       minus cooldown and consecutive-hold lockouts
       intersect recently demonstrated willingness
```

A profile is initially considered willing when it has accepted at least one moderation offer during the trailing willingness window. The window is a governed rail, not a hard-coded product constant.

The specification must distinguish three measurements:

1. **T1 capacity:** enough eligible profiles for one anonymous badge holder;
2. **T2 capacity:** enough eligible profiles for a multi-holder majority;
3. **Tribunal capacity:** enough rating-qualified profiles to seat the required Tribunal quorum.

Stage health must not be calculated from an easy case while difficult case classes are unstaffable. The implementation must define whether the global value is the minimum, a conservative percentile, or separate case-class values. The recommended initial rule is conservative case-class gating: a stage may advertise each capability only when that capability’s own threshold is met.

Illustrative placeholder rails from the source draft are retained for modeling only:

- T1 anonymity floor: 15;
- T2 anonymity floor: 30;
- Tribunal qualification floor: 20;
- stage thresholds: 15, 30, and 50;
- sustained across three anchor cadences;
- capability down-throttle at 70% of the enabling floor;
- willingness window: 30 days.

These values must not be ratified until privacy and adversarial modeling is complete.

## 7. Capability throttling

When a capability threshold is not met:

1. the affected case class enters a disclosed queue;
2. the transparency surface shows the deficit, current capacity, and queue depth;
3. the ordinary SLA clock is suspended and labeled as suspended;
4. content remains visible according to the existing blur-don't-erase rule;
5. severe and imminent-harm matters remain in the designated operations-and-counsel lane;
6. the system may activate the constitutional fallback when its published conditions are satisfied;
7. no fallback action may silently expand into unrelated moderation authority.

The system should prefer a transparent, rule-bound fallback over an indefinite queue when the Constitution and approved rails authorize that continuity path.

## 8. Interim bench and fallback safeguards

While S0–S2 fallback authority exists:

- assignments rotate;
- the actor is recused from conflicts;
- bench/fallback decisions receive second review whenever practicable;
- decisions cite the applicable rule and evidence basis;
- all decisions are nullifier-keyed or otherwise privacy-preserving;
- decisions are tombstoned and auditable;
- the public dashboard reports bench, community, and fallback shares;
- appeals are handled by a separate eligible reviewer or the next authorized review body;
- the fallback cannot appoint itself, alter its own rails, or suppress the public record.

At S0, independent appeal may be structurally limited. That limitation must be displayed plainly rather than described as independent review.

### 8.1 S0 solo-operator rule

AgoraNet's initial testnet may have only one available operations lead. S0
therefore does not require two people before routine moderation can function.
An active support `lead` or `security` grant is the authorization for the
named solo fallback; an ordinary signed-in profile or a support `agent` is not.

The solo fallback is limited to routine, non-heavy, non-Tribunal cases. The
moderator is recused from their own content, their own flags, related interests,
and any appeal of a case they ruled. Heavy, severe, Tribunal, and appealed
cases remain queued for the appropriate independent or Tribunal path. A solo
S0 ruling takes effect directly because there is no second reviewer yet, but
the ruling still records the operator profile, private gate nullifier, cited
rule, verdict, and timestamp. Appeals cannot return to that operator.

The fallback is enabled by default while the system is S0 and can be paused
with `MODERATION_SOLO_OPERATOR_ENABLED=false`. When the community capability
becomes active, the solo queue closes automatically; the existing sortition
path remains authoritative. The UI identifies the active state as an S0 solo
operations fallback and does not describe it as community moderation.

## 9. Tribunal seat conversion

The seven Tribunal seats convert individually rather than switching all at once.

- A seat may begin as a fallback-held placeholder.
- When its term ends and the Tribunal qualification threshold is met, it may convert to community sortition.
- A converted seat remains community-held unless a governance process authorizes a temporary constitutional fallback.
- Seat composition is public in aggregate.
- Quorum rules must state whether fallback-held seats count, and under which case classes.
- A bench/fallback member is recused from appeals of their own decisions.

The implementation must not allow a nominally “full community” Tribunal to operate when its actual quorum is unavailable. It should disclose the shortfall and use the approved fallback or queue behavior.

## 10. Handover state and technical enforcement

The Stage should be represented by a monotonic state transition where practical:

- a new Stage must be greater than the previous Stage for a normal advancement;
- an operator key cannot decrease the Stage;
- the application checks the current Stage before accepting a moderation action;
- each ruling records the Stage and capability state under which it was issued;
- stale, missing, or contradictory state does not silently authorize a more powerful actor;
- governance-approved fallback activation is a separate, explicit state with scope and expiry;
- database-only admin routes cannot bypass the state machine.

The contract should enforce the ratchet and authorization facts that can be verified on-chain. It should not pretend that an operator-supplied aggregate pool count is trustless. In Phase A, the pool calculation remains a disclosed platform computation backed by anchored event data. The intended Phase B endpoint is a privacy-preserving proof of threshold satisfaction without revealing the draw-set membership.

## 11. Offer issuance and anti-stall controls

The source draft correctly identifies that the operator could suppress handover by issuing too few offers. Before ratification, define:

- the expected offer cadence;
- the public rail governing that cadence;
- the evidence needed to show under-issuance;
- who may submit the evidence;
- how the dashboard distinguishes low willingness from low offer issuance;
- what remedy follows a proven deviation;
- whether governance may authorize an alternate offer issuer or activate fallback review.

The minimum Phase A promise should be “detectable and appealable under-issuance,” not “impossible operator influence.”

## 12. Identity departure and nullifier dependency

The handover model depends on the unresolved identity question: whether closing an account frees its registration nullifier.

Before implementation, AgoraNet must choose and document a policy that balances:

- the constitutional right to leave;
- ban-evasion resistance;
- the ability of the moderation pool to recover after departures;
- True Self and Alias separation;
- data minimization and unlinkability.

No pool-health calculation or Tribunal eligibility implementation should be declared final until this dependency is resolved.

## 13. Required edits to the existing system

This document is a change plan. It does not silently amend existing law.

### Documentation changes

1. Add the Stage model and constitutional fallback to the moderation specification.
2. Clarify that founder/staff moderation under ratified rules is not automatically a governance violation.
3. Add capability throttling, queue behavior, SLA suspension, and public disclosure.
4. Add Tribunal seat typing and conversion.
5. Add the operator anti-stall rail and its appeal/remedy.
6. Add the identity-nullifier dependency to the open-items register.
7. Add the Handover panel to transparency requirements.

### Product changes

1. Display current Stage and active capability thresholds.
2. Display whether a case is community, fallback, Tribunal, or operations handled.
3. Display fallback activation, scope, expiry/review date, and queue impact.
4. Explain why a case is queued without implying that moderation has silently failed.
5. Provide a public appeal path for fallback decisions.

### Data and service changes

1. Record offer, accept, pass, expiry, cooldown, ruling, review, and appeal events.
2. Anchor event batches on the established civic-ledger cadence.
3. Build a reproducible pool-health calculator.
4. Implement case-class capability gates.
5. Add a Stage/fallback state machine and reject inconsistent actions.
6. Add audit and reconciliation checks between database actions, anchors, and on-chain state.

### Contract changes

1. Specify the Stage state UTxO and monotonic transition validator.
2. Specify the constitutional fallback state, scope, expiry, and governance authorization.
3. Specify what a moderation ruling must reference.
4. Test that operator credentials cannot decrease Stage or expand fallback scope.
5. Keep the Phase B ZK threshold proof out of the initial implementation scope.

## 14. Implementation plan

### Phase 0; decisions and modeling

- Confirm the revised authority principle.
- Resolve the identity-nullifier closure policy.
- Model anonymity loss under repeated draws and Circle overlap.
- Choose the global/case-class pool-health calculation.
- Set provisional rails and document them as testnet-only.

### Phase 1; observability without authority changes

- Add event collection and anchored measurement.
- Build a read-only Handover panel.
- Compute T1, T2, and Tribunal capacity without changing routing.
- Verify that the calculator is reproducible from event inputs.

### Phase 2; staged application routing

- Add S0–S3 routing decisions in the application.
- Add queue and throttle behavior.
- Add fallback scope and expiry checks.
- Add audit records and appeals.
- Keep the existing moderation path available behind a testnet feature flag.

### Phase 3; contract-backed ratchet

- Implement and test the monotonic Stage validator.
- Bind moderation actions to Stage state.
- Add permissionless advancement proofs for the Phase A event model.
- Test stale state, replay, operator misuse, and chain unavailability.

### Phase 4; supervised testnet transition

- Start with a simulated S0 bench.
- Run S1 with synthetic and real testnet event streams.
- Force pool shrinkage and confirm capability throttles without unauthorized power restoration.
- Exercise the constitutional fallback and appeals.
- Publish the Handover panel and test user comprehension.

### Phase 5; ratification and production gating

- Complete privacy, identity, and adversarial modeling.
- Ratify the document and apply its amendments to the existing moderation specification.
- Review legal and constitutional implications.
- Require migration-first deployment, rollback plan, and owner approval before production activation.

## 15. Acceptance criteria

The revision is not ready for production until all of these are true:

- A low pool cannot expose a hidden moderator roster through assignment behavior.
- Capability throttling does not silently restore discretionary founder authority.
- A constitutional fallback can process its permitted case classes under published rules.
- Fallback scope, expiry/review, actors, decisions, and appeals are auditable.
- The operator cannot lower Stage or expand fallback scope through an admin route.
- Stage and capability state are consistent across the application, database, ledger, and contract.
- T3/imminent-harm routing remains available during ordinary-pool collapse.
- Pool health is reproducible from anchored inputs.
- Identity closure and ban-evasion behavior are explicitly specified.
- Users can understand why a case is community-handled, fallback-handled, queued, or escalated.

## 16. Open decisions for the owner

1. Approve the revised principle: no unchecked founder discretion, but a constitutional fallback is permitted.
2. Decide whether fallback authority is founder-operated, staff-operated, or a named multi-person operations function during S0.
3. Decide whether the fallback is automatically triggered by a capability deficit or requires a governance/operations declaration.
4. Resolve the identity-nullifier closure policy.
5. Approve provisional pool-health rails for testnet modeling only.
6. Choose whether S3 means “community handles all ordinary cases” or “community handles all cases for which the measured capacity is sufficient.”
7. Define the appeal body when the fallback actor issued the original decision.

## 17. Final position

AgoraNet should not treat founder involvement and founder discretion as the same thing. The constitutional objective is not to eliminate every founder or staff action; it is to prevent any person from becoming an unreviewable source of law, judgment, or permanent authority.

The revised design therefore preserves the community handover while adding a legitimate continuity mechanism:

> Community governance is the destination. Constitutional, rule-bound administration is the safety rail. Neither may become unchecked personal power.

## 18. Initial implementation checkpoint

The first bootstrap slice is now implemented in the application:

- community badge offers default to paused S0 behavior;
- offers are not issued below the configured minimum eligible-profile count;
- pending offers are withdrawn when bootstrap gating is active;
- stale unread badge-offer notifications are removed while read history remains;
- the moderation workbench reports that community moderation is still in bootstrap;
- the workbench distinguishes active profiles from profiles that have recently accepted a badge term;
- an active support lead or security operator can handle routine, non-heavy S0
  cases without fabricating a moderation badge;
- the S0 UI discloses the solo fallback, keeps heavy/severe/appealed cases out
  of its queue, and explains that appeals require a later independent reviewer;
- a regression test verifies that a small pool cannot generate community offers.

This is intentionally not a claim that the full handover is complete. The
staged pool-health calculator, richer constitutional fallback routing, Tribunal
conversion, anchored event model, and contract-backed ratchet remain the next
implementation phases described above.
