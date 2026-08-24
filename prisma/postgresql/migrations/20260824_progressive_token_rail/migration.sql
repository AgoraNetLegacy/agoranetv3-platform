-- Progressive token rail foundation. Additive by design: existing profiles
-- remain in Credits mode and the existing economy tables are untouched.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "economyMode" TEXT NOT NULL DEFAULT 'credits';

-- The only new treasury outflow is a mechanically constrained return of a
-- failed, unsubmitted claim reservation. Preserve any operator decision to
-- deactivate the category by never updating the `active` column here.
INSERT INTO "BudgetCategory" ("name", "description", "cap", "active", "createdAt", "updatedAt")
VALUES (
    'credit-claim-refunds',
    'Mechanical return of Credits reserved for a testnet asset claim that reached a terminal failure. This cannot fund discretionary spending; it only unwinds the identity''s own claim reservation.',
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE SET
    "description" = EXCLUDED."description",
    "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "AssetDefinition" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 0,
    "displayName" TEXT NOT NULL,
    "isTestAsset" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WalletBalanceSnapshot" (
    "profileId" TEXT NOT NULL,
    "assetDefinitionId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceBlock" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'current',
    "errorCode" TEXT,

    CONSTRAINT "WalletBalanceSnapshot_pkey" PRIMARY KEY ("profileId", "assetDefinitionId")
);

CREATE TABLE IF NOT EXISTS "TokenTransactionIntent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "sourceWalletScope" TEXT,
    "destinationWalletScope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "txHash" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenTransactionIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreditClaim" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "creditAmount" DOUBLE PRECISION NOT NULL,
    "assetAmount" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "transactionIntentId" TEXT NOT NULL,
    "reservationEntryId" TEXT,
    "finalizationEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AssetDefinition_chain_network_policyId_assetName_key"
    ON "AssetDefinition"("chain", "network", "policyId", "assetName");
CREATE INDEX IF NOT EXISTS "AssetDefinition_network_active_idx"
    ON "AssetDefinition"("network", "active");
CREATE INDEX IF NOT EXISTS "WalletBalanceSnapshot_profileId_observedAt_idx"
    ON "WalletBalanceSnapshot"("profileId", "observedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "TokenTransactionIntent_txHash_key"
    ON "TokenTransactionIntent"("txHash");
CREATE UNIQUE INDEX IF NOT EXISTS "TokenTransactionIntent_idempotencyKey_key"
    ON "TokenTransactionIntent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "TokenTransactionIntent_profileId_status_createdAt_idx"
    ON "TokenTransactionIntent"("profileId", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditClaim_transactionIntentId_key"
    ON "CreditClaim"("transactionIntentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditClaim_reservationEntryId_key"
    ON "CreditClaim"("reservationEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditClaim_finalizationEntryId_key"
    ON "CreditClaim"("finalizationEntryId");
CREATE INDEX IF NOT EXISTS "CreditClaim_profileId_status_createdAt_idx"
    ON "CreditClaim"("profileId", "status", "createdAt");
