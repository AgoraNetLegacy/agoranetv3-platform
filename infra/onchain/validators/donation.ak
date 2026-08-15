//// The Slice 3 donation-lock validator (ONCHAIN_ECONOMY_MIGRATION.md §5).
//// Thin by design: the rule lives in `agoranet/donation.can_collect`,
//// where it is unit-tested; this wrapper only wires it to the script
//// context. Testnet-only; nothing of real value ever sits behind it.

use agoranet/donation.{DonationDatum, can_collect}
use cardano/transaction.{OutputReference, Transaction}

validator donation_lock {
  spend(
    datum: Option<DonationDatum>,
    _redeemer: Data,
    _utxo: OutputReference,
    self: Transaction,
  ) {
    expect Some(d) = datum
    can_collect(
      d,
      self.extra_signatories,
      self.validity_range.lower_bound.bound_type,
    )
  }

  else(_) {
    fail
  }
}
