//// AgoraNet on-chain donation lock; Slice 3 (ONCHAIN_ECONOMY_MIGRATION.md).
////
//// The "hello world" of non-custody, adapted from the Mesh vesting
//// pattern: a donor locks value at the script address; it can leave
//// ONLY through a transaction this logic accepts; the beneficiary
//// signed, and the transaction provably begins at or after the unlock
//// time. No operator path exists. The platform cannot spend, freeze,
//// or redirect what sits here; it never could; the funds went from
//// the donor's wallet to the script, and the script answers to math.
////
//// Track 2 replaces the single beneficiary with the M-of-N release
//// rule already proven in `treasury.ak` (threshold_met).

use aiken/collection/list
use aiken/interval.{Finite, IntervalBoundType}

/// What the donor locks alongside the funds.
pub type DonationDatum {
  /// Who may collect; a verification-key hash.
  beneficiary: ByteArray,
  /// POSIX time (milliseconds). Collection is refused before this.
  unlock_after: Int,
}

/// The collect rule. `lower_bound` is the spending transaction's
/// validity-range start: the only honest "what time is it" a
/// deterministic validator can consult. An unbounded start proves
/// nothing about time, so it is refused.
pub fn can_collect(
  datum: DonationDatum,
  signatories: List<ByteArray>,
  lower_bound: IntervalBoundType,
) -> Bool {
  let signed = list.has(signatories, datum.beneficiary)
  let after_unlock =
    when lower_bound is {
      Finite(t) -> t >= datum.unlock_after
      _ -> False
    }
  signed && after_unlock
}

const beneficiary = #"aa"

const someone_else = #"bb"

fn datum() -> DonationDatum {
  DonationDatum { beneficiary, unlock_after: 1000 }
}

test collects_when_signed_after_unlock() {
  can_collect(datum(), [someone_else, beneficiary], Finite(1500))
}

test collects_exactly_at_unlock() {
  can_collect(datum(), [beneficiary], Finite(1000))
}

test refuses_before_unlock() {
  !can_collect(datum(), [beneficiary], Finite(999))
}

test refuses_unsigned_beneficiary() {
  !can_collect(datum(), [someone_else], Finite(1500))
}

test refuses_unbounded_validity_start() {
  // A transaction with no finite start proves nothing about time;
  // an attacker could otherwise collect early with an open interval.
  !can_collect(datum(), [beneficiary], interval.NegativeInfinity)
}
