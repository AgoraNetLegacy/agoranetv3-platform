-- Restricted Help & Support operator workflow. Operator grants are attached
-- to one Profile only; no Human relation or cross-identity lookup is added.
CREATE TABLE "SupportOperator" (
    "profileId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'agent',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportOperator_pkey" PRIMARY KEY ("profileId")
);

ALTER TABLE "SupportCase" ADD COLUMN "assignedOperatorId" TEXT;
ALTER TABLE "SupportCase" ADD COLUMN "knownIssueId" TEXT;
ALTER TABLE "SupportCase" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "SupportCase" ADD COLUMN "closedAt" TIMESTAMP(3);
UPDATE "SupportCase" SET "status" = 'new' WHERE "status" = 'open';
ALTER TABLE "SupportCase" ALTER COLUMN "status" SET DEFAULT 'new';

CREATE TABLE "SupportInternalNote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorOperatorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportInternalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportAuditEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "actorProfileId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportOperator_active_role_idx" ON "SupportOperator"("active", "role");
CREATE INDEX "SupportCase_assignedOperatorId_status_updatedAt_idx" ON "SupportCase"("assignedOperatorId", "status", "updatedAt");
CREATE INDEX "SupportInternalNote_caseId_createdAt_idx" ON "SupportInternalNote"("caseId", "createdAt");
CREATE INDEX "SupportAuditEvent_caseId_createdAt_idx" ON "SupportAuditEvent"("caseId", "createdAt");
CREATE INDEX "SupportAuditEvent_actorProfileId_createdAt_idx" ON "SupportAuditEvent"("actorProfileId", "createdAt");

ALTER TABLE "SupportOperator" ADD CONSTRAINT "SupportOperator_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_assignedOperatorId_fkey"
    FOREIGN KEY ("assignedOperatorId") REFERENCES "SupportOperator"("profileId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportInternalNote" ADD CONSTRAINT "SupportInternalNote_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportInternalNote" ADD CONSTRAINT "SupportInternalNote_authorOperatorId_fkey"
    FOREIGN KEY ("authorOperatorId") REFERENCES "SupportOperator"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAuditEvent" ADD CONSTRAINT "SupportAuditEvent_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAuditEvent" ADD CONSTRAINT "SupportAuditEvent_actorProfileId_fkey"
    FOREIGN KEY ("actorProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
