//// The Slice 4a release-lock validator (ONCHAIN_ECONOMY_MIGRATION.md
//// §5, owner-ruled 2026-07-18: our primitives first; Anastasia's
//// upgradable contract evaluated in 4b). Thin by design: the rule is
//// `treasury.release_permitted`, unit-tested where it lives; this
//// wrapper wires it to the script context. Funds locked here move
//// ONLY when M of the datum's N authorised signers co-sign the
//// spending transaction — attestRelease's threshold, as mathematics.

use agoranet/treasury.{ReleaseDatum, release_permitted}
use cardano/transaction.{OutputReference, Transaction}

validator release_lock {
  spend(
    datum: Option<ReleaseDatum>,
    _redeemer: Data,
    _utxo: OutputReference,
    self: Transaction,
  ) {
    expect Some(d) = datum
    release_permitted(d, self.extra_signatories)
  }

  else(_) {
    fail
  }
}
