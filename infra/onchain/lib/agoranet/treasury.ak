//// AgoraNet on-chain mission treasury — Slice 1 (ONCHAIN_ECONOMY_MIGRATION.md).
////
//// The seed of the release authority (#5 crux): the *validator*, not an
//// operator, decides whether funds may move. Here we prove the two pure
//// building blocks it rests on — "a designated signer signed" and "M of N
//// authorised signers signed" — the on-chain twin of `attestRelease`'s
//// co-signature threshold. Later slices lock real value behind these.

use aiken/collection/list

/// A signer's on-chain identity (a verification-key hash).
pub type Signer =
  ByteArray

/// True when `who` is among the transaction's signatories.
pub fn signed_by(signatories: List<Signer>, who: Signer) -> Bool {
  list.has(signatories, who)
}

/// How many of the treasury's authorised signers actually signed.
pub fn count_signed(
  authorised: List<Signer>,
  signatories: List<Signer>,
) -> Int {
  authorised
    |> list.filter(fn(s) { list.has(signatories, s) })
    |> list.length()
}

/// The M-of-N release rule: at least `threshold` authorised signers signed.
/// This is the mathematical form of "N members attested → release" —
/// no operator key can satisfy it, and none can withhold it.
pub fn threshold_met(
  authorised: List<Signer>,
  signatories: List<Signer>,
  threshold: Int,
) -> Bool {
  count_signed(authorised, signatories) >= threshold
}

test signer_present() {
  signed_by([#"bb", #"aa"], #"aa")
}

test signer_absent() {
  !signed_by([#"bb", #"cc"], #"aa")
}

test counts_only_authorised_signers() {
  // authorised aa,bb,cc — signed aa,cc,dd — dd is not authorised → 2.
  count_signed([#"aa", #"bb", #"cc"], [#"aa", #"cc", #"dd"]) == 2
}

test threshold_met_at_two_of_three() {
  threshold_met([#"aa", #"bb", #"cc"], [#"aa", #"cc", #"dd"], 2)
}

test threshold_not_met_below() {
  !threshold_met([#"aa", #"bb", #"cc"], [#"aa", #"dd"], 2)
}
