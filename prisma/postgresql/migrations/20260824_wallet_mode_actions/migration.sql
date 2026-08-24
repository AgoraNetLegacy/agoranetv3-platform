-- First load-bearing Wallet-mode product action. Additive and inert while
-- WALLET_MODE_TESTNET_ENABLED / WALLET_DISCUSSION_FEE_ENABLED remain false.
CREATE TABLE IF NOT EXISTS "WalletActionDraft" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "transactionIntentId" TEXT NOT NULL,
    "resultRefId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletActionDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WalletActionDraft_transactionIntentId_key"
    ON "WalletActionDraft"("transactionIntentId");
CREATE INDEX IF NOT EXISTS "WalletActionDraft_profileId_status_createdAt_idx"
    ON "WalletActionDraft"("profileId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "WalletActionDraft_status_expiresAt_idx"
    ON "WalletActionDraft"("status", "expiresAt");
