-- On-chain migration Slice 2: the user-signed self-custody proof tx.
-- Additive only — two nullable columns; nothing deleted, nothing rewritten.
ALTER TABLE "TestnetWalletLink" ADD COLUMN "proofTxHash" TEXT;
ALTER TABLE "TestnetWalletLink" ADD COLUMN "proofAt" TIMESTAMP(3);
