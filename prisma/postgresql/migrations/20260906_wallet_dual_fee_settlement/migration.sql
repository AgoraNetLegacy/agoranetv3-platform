-- Wallet-mode settlement for the Pollinator's dual-token fees.
--
-- A chamber costs 20 dPOLL AND 20 dGRA (NEURAL_POLLINATOR §3). Cardano
-- carries both assets in one transaction, so a dual payment stays ONE
-- intent with ONE txHash; the unique-txHash guard against replaying a
-- payment across two actions is preserved. Null on single-asset intents.
ALTER TABLE "TokenTransactionIntent"
  ADD COLUMN IF NOT EXISTS "secondaryCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "secondaryAmount" TEXT;
