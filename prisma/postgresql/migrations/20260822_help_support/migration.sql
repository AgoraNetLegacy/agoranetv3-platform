-- Help & Support base case storage for existing PostgreSQL deployments.
-- This mirrors the SupportCase DDL folded into the consolidated 0_init
-- migration for fresh databases.
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "contactEmail" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'normal',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "safeContext" TEXT,
    "sourceArticle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportCase_status_severity_createdAt_idx"
ON "SupportCase"("status", "severity", "createdAt");

CREATE INDEX "SupportCase_profileId_createdAt_idx"
ON "SupportCase"("profileId", "createdAt");
