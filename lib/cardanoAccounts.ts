import { deserializeAddress, serializeRewardAddress } from "@meshsdk/core";

/** Stable account identity shared by a Cardano wallet's rotating payment
 * addresses. Returns null for addresses without a stake credential and for
 * deliberately malformed test fixtures. */
export function walletAccountFingerprint(address: string): string | null {
  try {
    const parsed = deserializeAddress(address);
    if (parsed.stakeCredentialHash) return `key:${parsed.stakeCredentialHash}`;
    if (parsed.stakeScriptCredentialHash) return `script:${parsed.stakeScriptCredentialHash}`;
    return null;
  } catch {
    return null;
  }
}

export function sameWalletAccount(left: string, right: string): boolean {
  const leftAccount = walletAccountFingerprint(left);
  const rightAccount = walletAccountFingerprint(right);
  return leftAccount !== null && rightAccount !== null
    ? leftAccount === rightAccount
    : left === right;
}

export function testnetRewardAddressFor(address: string): string | null {
  const parsed = deserializeAddress(address);
  if (parsed.stakeCredentialHash) {
    return serializeRewardAddress(parsed.stakeCredentialHash, false, 0);
  }
  if (parsed.stakeScriptCredentialHash) {
    return serializeRewardAddress(parsed.stakeScriptCredentialHash, true, 0);
  }
  return null;
}
