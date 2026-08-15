//// The mission-treasury validator (Track 2 Slice 5;
//// ONCHAIN_TREASURY_VALIDATOR_SPEC.md). One script, two UTxO kinds:
//// the chamber's NFT-carried State thread, and non-custodial Donation
//// UTxOs. The rules live in `agoranet/mission` where they are
//// unit-tested; this file wires them to the chain and enforces the
//// value flows. Double satisfaction is closed by construction: the
//// payout is ONE indexed output validated ONCE by the single State
//// spend, and donations only leave inside a threshold-approved
//// Release whose remainder-return rule counts them.

use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use agoranet/mission.{
  Donation, State, TreasuryDatum, init_valid, may_propose, propose_transition,
  release_ready, release_transition, set_frozen_transition,
}
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets.{PolicyId, lovelace_of, quantity_of, tokens}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Spend, Transaction, find_input,
}

/// The state NFT's asset name (⭐ constant; seed-derived names are a
/// before-mainnet upgrade; see spec §3).
const state_name: ByteArray = "STATE"

pub type TreasuryMint {
  InitTreasury { state_out: Int }
}

pub type TreasurySpend {
  Propose { state_out: Int }
  Release { state_out: Int, pay_out: Int }
  SetFrozen { state_out: Int }
  ReleaseSupport
}

/// Parse an output's inline datum as ours, or fail the transaction.
fn datum_of(out: Output) -> TreasuryDatum {
  expect InlineDatum(d) = out.datum
  expect td: TreasuryDatum = d
  td
}

/// Soft check: is this output a State UTxO of the given chamber?
/// (Soft; foreign datums must yield False, not a crash.)
fn is_state_of(out: Output, chamber: ByteArray) -> Bool {
  when out.datum is {
    InlineDatum(d) ->
      if d is td: TreasuryDatum {
        when td is {
          State { chamber_id, .. } -> chamber_id == chamber
          _ -> False
        }
      } else {
        False
      }
    _ -> False
  }
}

/// The continuing State output: at our address, still carrying the NFT.
fn continuing_state(out: Output, own_addr: Address, own_hash: ByteArray) -> Bool {
  out.address == own_addr && quantity_of(out.value, own_hash, state_name) == 1
}

/// Total lovelace entering this tx from our address's Donation UTxOs
/// of the given chamber; the pool the Release must account for.
fn donation_lovelace(
  inputs: List<Input>,
  own_addr: Address,
  chamber: ByteArray,
) -> Int {
  list.foldl(
    inputs,
    0,
    fn(i, acc) {
      if i.output.address == own_addr {
        when i.output.datum is {
          InlineDatum(d) ->
            if d is td: TreasuryDatum {
              when td is {
                Donation { chamber_id } ->
                  if chamber_id == chamber {
                    acc + lovelace_of(i.output.value)
                  } else {
                    acc
                  }
                _ -> acc
              }
            } else {
              acc
            }
          _ -> acc
        }
      } else {
        acc
      }
    },
  )
}

/// Was the given input spent with the Release redeemer? (The delegated
/// check that makes Propose/SetFrozen unable to sweep donations.)
fn spent_with_release(self: Transaction, oref: OutputReference) -> Bool {
  when pairs.get_first(self.redeemers, Spend(oref)) is {
    Some(rd) ->
      if rd is r: TreasurySpend {
        when r is {
          Release { .. } -> True
          _ -> False
        }
      } else {
        False
      }
    None -> False
  }
}

validator mission_treasury {
  mint(r: TreasuryMint, own_policy: PolicyId, self: Transaction) {
    let InitTreasury { state_out } = r
    // Exactly one STATE token minted, landing in a sane State UTxO at
    // this validator's own address.
    expect [Pair(name, qty)] = self.mint |> tokens(own_policy) |> dict.to_pairs()
    expect Some(out) = list.at(self.outputs, state_out)
    and {
      name == state_name,
      qty == 1,
      out.address.payment_credential == Script(own_policy),
      quantity_of(out.value, own_policy, state_name) == 1,
      init_valid(datum_of(out)),
    }
  }

  spend(
    datum_opt: Option<TreasuryDatum>,
    r: TreasurySpend,
    oref: OutputReference,
    self: Transaction,
  ) {
    expect Some(own_input) = find_input(self.inputs, oref)
    let own_addr = own_input.output.address
    expect Script(own_hash) = own_addr.payment_credential
    expect Some(old) = datum_opt
    when (old, r) is {
      // A proposal: terms land in the datum, value stays put.
      (State { signers, .. }, Propose { state_out }) -> {
        expect Some(out) = list.at(self.outputs, state_out)
        and {
          may_propose(signers, self.extra_signatories),
          continuing_state(out, own_addr, own_hash),
          lovelace_of(out.value) >= lovelace_of(own_input.output.value),
          propose_transition(old, datum_of(out)),
        }
      }
      // THE §4 PROMISE: threshold co-signatures on THIS transaction,
      // payout in this transaction, remainder provably back to the pot.
      (State { chamber_id, .. }, Release { state_out, pay_out }) -> {
        expect Some(p) = release_ready(old, self.extra_signatories)
        expect Some(cont) = list.at(self.outputs, state_out)
        expect Some(pay) = list.at(self.outputs, pay_out)
        let donations = donation_lovelace(self.inputs, own_addr, chamber_id)
        and {
          continuing_state(cont, own_addr, own_hash),
          release_transition(old, datum_of(cont)),
          lovelace_of(cont.value) >= lovelace_of(own_input.output.value) + donations - p.amount,
          pay.address.payment_credential == VerificationKey(p.recipient),
          lovelace_of(pay.value) == p.amount,
        }
      }
      // The Tribunal's brake: only `frozen` moves, only their key turns it.
      (State { .. }, SetFrozen { state_out }) -> {
        expect Some(out) = list.at(self.outputs, state_out)
        and {
          continuing_state(out, own_addr, own_hash),
          lovelace_of(out.value) >= lovelace_of(own_input.output.value),
          set_frozen_transition(old, datum_of(out), self.extra_signatories),
        }
      }
      // A donation leaves ONLY inside its chamber's Release.
      (Donation { chamber_id }, ReleaseSupport) ->
        when
          list.find(
            self.inputs,
            fn(i) {
              i.output.address == own_addr && quantity_of(
                i.output.value,
                own_hash,
                state_name,
              ) == 1 && is_state_of(i.output, chamber_id)
            },
          )
        is {
          Some(st) -> spent_with_release(self, st.output_reference)
          None -> False
        }
      _ -> False
    }
  }

  else(_) {
    fail
  }
}
