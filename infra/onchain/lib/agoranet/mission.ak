//// The mission-treasury core (Track 2 Slice 5;
//// ONCHAIN_TREASURY_VALIDATOR_SPEC.md, owner rulings 2026-07-18:
//// signers = the chamber's attesting members; freeze = Tribunal-held
//// attestation). Pure state-transition logic, unit-tested here; the
//// validator wires it to the chain. Every rule that was a code-review
//// guarantee in the DB escrow is a mathematical property here.

use aiken/collection/list
use agoranet/treasury.{Signer, threshold_met}

/// A release proposal; terms frozen the moment it's recorded (§4).
pub type Pending {
  recipient: Signer,
  amount: Int,
  purpose_hash: ByteArray,
}

/// The two kinds of UTxO at the treasury script.
pub type TreasuryDatum {
  /// The chamber's thread of truth; exactly one, NFT-carried.
  State {
    chamber_id: ByteArray,
    signers: List<Signer>,
    threshold: Int,
    tribunal: Signer,
    frozen: Bool,
    pending: Option<Pending>,
  }
  /// A donor's non-custodial gift, tagged to its chamber.
  Donation { chamber_id: ByteArray }
}

/// A fresh treasury must start sane: a real threshold within the
/// signer set, unfrozen, nothing pending.
pub fn init_valid(datum: TreasuryDatum) -> Bool {
  when datum is {
    State { signers, threshold, frozen: False, pending: None, .. } ->
      threshold >= 1 && threshold <= list.length(signers)
    _ -> False
  }
}

/// Any ONE attesting member may put a proposal on the table (⭐ spec
/// choice; the app layer narrows who in practice).
pub fn may_propose(signers: List<Signer>, signatories: List<Signer>) -> Bool {
  list.any(signers, fn(s) { list.has(signatories, s) })
}

/// Propose: identity preserved, pending None → Some(sane terms),
/// never while frozen.
pub fn propose_transition(old: TreasuryDatum, new: TreasuryDatum) -> Bool {
  when (old, new) is {
    (State {
      chamber_id: c1,
      signers: s1,
      threshold: t1,
      tribunal: tr1,
      frozen: False,
      pending: None,
    }, State {
      chamber_id: c2,
      signers: s2,
      threshold: t2,
      tribunal: tr2,
      frozen: False,
      pending: Some(p),
    }) ->
      c1 == c2 && s1 == s2 && t1 == t2 && tr1 == tr2 && p.amount > 0
    _ -> False
  }
}

/// The §4 promise: with a pending proposal, unfrozen, and M-of-N
/// co-signatures on THIS transaction, the release terms come back;
/// otherwise nothing does. No operator key appears anywhere.
pub fn release_ready(
  old: TreasuryDatum,
  signatories: List<Signer>,
) -> Option<Pending> {
  when old is {
    State { signers, threshold, frozen: False, pending: Some(p), .. } ->
      if threshold_met(signers, signatories, threshold) {
        Some(p)
      } else {
        None
      }
    _ -> None
  }
}

/// Release: identity preserved, the pending slot cleared.
pub fn release_transition(old: TreasuryDatum, new: TreasuryDatum) -> Bool {
  when (old, new) is {
    (State {
      chamber_id: c1,
      signers: s1,
      threshold: t1,
      tribunal: tr1,
      frozen: False,
      pending: Some(_),
    }, State {
      chamber_id: c2,
      signers: s2,
      threshold: t2,
      tribunal: tr2,
      frozen: False,
      pending: None,
    }) -> c1 == c2 && s1 == s2 && t1 == t2 && tr1 == tr2
    _ -> False
  }
}

/// SetFrozen: ONLY the tribunal key, and ONLY the frozen flag moves;
/// signers, threshold, pending, identity all held constant. The freeze
/// can block; it can never move value or rewrite the proposal.
pub fn set_frozen_transition(
  old: TreasuryDatum,
  new: TreasuryDatum,
  signatories: List<Signer>,
) -> Bool {
  when (old, new) is {
    (State {
      chamber_id: c1,
      signers: s1,
      threshold: t1,
      tribunal: tr1,
      frozen: _,
      pending: p1,
    }, State {
      chamber_id: c2,
      signers: s2,
      threshold: t2,
      tribunal: tr2,
      frozen: _,
      pending: p2,
    }) ->
      c1 == c2 && s1 == s2 && t1 == t2 && tr1 == tr2 && p1 == p2 && list.has(
        signatories,
        tr1,
      )
    _ -> False
  }
}

// ------------------------------------------------------------ tests

const s_a = #"aa"

const s_b = #"bb"

const s_c = #"cc"

const trib = #"dd"

fn base_state() -> TreasuryDatum {
  State {
    chamber_id: #"01",
    signers: [s_a, s_b, s_c],
    threshold: 2,
    tribunal: trib,
    frozen: False,
    pending: None,
  }
}

fn with_pending() -> TreasuryDatum {
  State {
    chamber_id: #"01",
    signers: [s_a, s_b, s_c],
    threshold: 2,
    tribunal: trib,
    frozen: False,
    pending: Some(Pending { recipient: #"ee", amount: 4, purpose_hash: #"ff" }),
  }
}

test init_sane_state_passes() {
  init_valid(base_state())
}

test init_refuses_impossible_threshold() {
  !init_valid(
    State {
      chamber_id: #"01",
      signers: [s_a],
      threshold: 2,
      tribunal: trib,
      frozen: False,
      pending: None,
    },
  )
}

test init_refuses_donation_datum() {
  !init_valid(Donation { chamber_id: #"01" })
}

test one_signer_may_propose_but_stranger_may_not() {
  and {
    may_propose([s_a, s_b, s_c], [#"99", s_b]),
    !may_propose([s_a, s_b, s_c], [#"99", trib]),
  }
}

test propose_freezes_terms_in() {
  propose_transition(base_state(), with_pending())
}

test propose_refuses_signer_set_swap() {
  let sneaky =
    State {
      chamber_id: #"01",
      signers: [#"99"],
      threshold: 1,
      tribunal: trib,
      frozen: False,
      pending: Some(
        Pending { recipient: #"ee", amount: 4, purpose_hash: #"ff" },
      ),
    }
  !propose_transition(base_state(), sneaky)
}

test release_ready_at_threshold_only() {
  and {
    release_ready(with_pending(), [s_a, s_c]) == Some(
      Pending { recipient: #"ee", amount: 4, purpose_hash: #"ff" },
    ),
    release_ready(with_pending(), [s_a, #"99"]) == None,
    release_ready(base_state(), [s_a, s_c]) == None,
  }
}

test release_ready_refuses_when_frozen() {
  let frozen =
    State {
      chamber_id: #"01",
      signers: [s_a, s_b, s_c],
      threshold: 2,
      tribunal: trib,
      frozen: True,
      pending: Some(
        Pending { recipient: #"ee", amount: 4, purpose_hash: #"ff" },
      ),
    }
  release_ready(frozen, [s_a, s_b, s_c]) == None
}

test release_clears_the_pending_slot() {
  release_transition(with_pending(), base_state())
}

test tribunal_freezes_and_lifts_nothing_else_moves() {
  let frozen =
    State {
      chamber_id: #"01",
      signers: [s_a, s_b, s_c],
      threshold: 2,
      tribunal: trib,
      frozen: True,
      pending: None,
    }
  and {
    set_frozen_transition(base_state(), frozen, [trib]),
    set_frozen_transition(frozen, base_state(), [trib]),
    !set_frozen_transition(base_state(), frozen, [s_a, s_b, s_c]),
  }
}

test freeze_cannot_smuggle_a_signer_swap() {
  let sneaky =
    State {
      chamber_id: #"01",
      signers: [#"99"],
      threshold: 1,
      tribunal: trib,
      frozen: True,
      pending: None,
    }
  !set_frozen_transition(base_state(), sneaky, [trib])
}
