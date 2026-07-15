-- CreateTable
CREATE TABLE "Human" (
    "id" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Human_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "humanId" TEXT,
    "face" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameChangedAt" TIMESTAMP(3),
    "accessKeyHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rateLimitedUntil" TIMESTAMP(3),
    "readOnlyUntil" TIMESTAMP(3),
    "activateAt" TIMESTAMP(3),
    "joinedPeriod" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "bioPlace" TEXT NOT NULL DEFAULT '',
    "switchAnimation" TEXT NOT NULL DEFAULT 'flip',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandleTombstone" (
    "handle" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "tombstonedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandleTombstone_pkey" PRIMARY KEY ("handle")
);

-- CreateTable
CREATE TABLE "Balance" (
    "profileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("profileId","currency")
);

-- CreateTable
CREATE TABLE "TreasuryBalance" (
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "TreasuryBalance_pkey" PRIMARY KEY ("currency")
);

-- CreateTable
CREATE TABLE "EconomyEntry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fromProfileId" TEXT,
    "fromTreasury" BOOLEAN NOT NULL DEFAULT false,
    "toProfileId" TEXT,
    "toTreasury" BOOLEAN NOT NULL DEFAULT false,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tipperProfileId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceObject" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostSource" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "vouch" TEXT NOT NULL,
    "sharerProfileId" TEXT NOT NULL,
    "sharerHandle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuesAnswer" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValuesAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentAck" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentAck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoulSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeProfileId" TEXT,
    "lastSwitchAt" TIMESTAMP(3),

    CONSTRAINT "SoulSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionFace" (
    "sessionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionFace_pkey" PRIMARY KEY ("sessionId","profileId")
);

-- CreateTable
CREATE TABLE "PillarLock" (
    "sessionId" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PillarLock_pkey" PRIMARY KEY ("sessionId","pillarId")
);

-- CreateTable
CREATE TABLE "GateRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeKind" TEXT NOT NULL,
    "ledgerRecording" TEXT NOT NULL DEFAULT 'pseudonymous',
    "status" TEXT NOT NULL,
    "nullifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "GateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NullifierSpend" (
    "scope" TEXT NOT NULL,
    "nullifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NullifierSpend_pkey" PRIMARY KEY ("scope","nullifier")
);

-- CreateTable
CREATE TABLE "LedgerEvent" (
    "seq" SERIAL NOT NULL,
    "prevHash" TEXT NOT NULL,
    "entryHash" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anchoredAt" TIMESTAMP(3),
    "anchorRef" TEXT,

    CONSTRAINT "LedgerEvent_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "Pillar" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classicalName" TEXT NOT NULL,
    "loreName" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "colorPrimary" TEXT NOT NULL,
    "colorLight" TEXT NOT NULL,
    "colorDark" TEXT NOT NULL,
    "isMeta" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Pillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "lens" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "openingQuestion" TEXT NOT NULL,
    "openingQuestionProvenance" TEXT NOT NULL,
    "reality" TEXT NOT NULL,
    "impactPoint" TEXT NOT NULL,
    "forwardMarker" TEXT NOT NULL,
    "stoicPrinciple" TEXT NOT NULL,
    "stoicLens" TEXT NOT NULL,
    "openForRepair" TEXT NOT NULL,
    "inService" TEXT,
    "extras" TEXT NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PictureRevision" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "repairId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PictureRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PictureRepair" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorDisplayName" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "proposedText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "pollId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PictureRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rail" (
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "boundMin" DOUBLE PRECISION NOT NULL,
    "boundMax" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Rail_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discussion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "circleId" TEXT,
    "chamberId" TEXT,
    "questionId" TEXT,
    "domainId" TEXT,
    "pollId" TEXT,
    "permanence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "creatorHandle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "consensusThreshold" DOUBLE PRECISION,
    "mode" TEXT NOT NULL,
    "isGovernance" BOOLEAN NOT NULL DEFAULT false,
    "liveTally" BOOLEAN NOT NULL DEFAULT false,
    "visibilityScope" TEXT NOT NULL DEFAULT 'public',
    "circleRef" TEXT,
    "circleAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nominalCloseAt" TIMESTAMP(3) NOT NULL,
    "trueCloseAt" TIMESTAMP(3) NOT NULL,
    "candleSalt" TEXT,
    "candleCommitment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "tally" INTEGER,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ballot" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "nullifier" TEXT NOT NULL,
    "voterProfileId" TEXT,
    "voterHandle" TEXT,
    "voterDisplayName" TEXT,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counted" BOOLEAN,

    CONSTRAINT "Ballot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BallotChoice" (
    "ballotId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "BallotChoice_pkey" PRIMARY KEY ("ballotId","optionId")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorProfileId" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorDisplayName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "humanMade" BOOLEAN NOT NULL DEFAULT false,
    "permanentUpgraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editableUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostRevision" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "dmExcerptId" TEXT,
    "ruleId" TEXT NOT NULL,
    "note" TEXT,
    "reporterProfileId" TEXT NOT NULL,
    "nullifier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "depositHeld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModCase" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "dmExcerptId" TEXT,
    "ruleId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "heavy" BOOLEAN NOT NULL DEFAULT false,
    "expedited" BOOLEAN NOT NULL DEFAULT false,
    "tribunal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "outcome" TEXT,
    "badFaithFlag" BOOLEAN NOT NULL DEFAULT false,
    "sentinelBundled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "appealOfId" TEXT,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruling" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "moderatorNullifier" TEXT NOT NULL,
    "moderatorProfileId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "citedRuleId" TEXT,
    "badFaithFlag" BOOLEAN NOT NULL DEFAULT false,
    "supervision" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ruling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeOffer" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',

    CONSTRAINT "BadgeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeTerm" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "casesCompleted" INTEGER NOT NULL DEFAULT 0,
    "gratiumEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BadgeTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strike" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "caseId" TEXT NOT NULL,
    "restorative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decaysAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightScoreAdjustment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "caseId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decaysAt" TIMESTAMP(3),

    CONSTRAINT "LightScoreAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TribunalSeat" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "termStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TribunalSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "aggregationKey" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "pillarId" TEXT,
    "domainId" TEXT,
    "placeTag" TEXT,
    "problem" TEXT,
    "founderProfileId" TEXT NOT NULL,
    "founderHandle" TEXT NOT NULL,
    "attestationThreshold" INTEGER NOT NULL DEFAULT 2,
    "removalBarPercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CirclePurposeRevision" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "pillarSlug" TEXT,
    "placeTag" TEXT,
    "problem" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CirclePurposeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleMember" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "CircleMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionEntry" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorDisplayName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "didAt" TEXT,
    "place" TEXT,
    "correctionOfId" TEXT,
    "attestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "attestorProfileId" TEXT NOT NULL,
    "attestorHandle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceOffer" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "memberHandle" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionEntryPledge" (
    "entryId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "ActionEntryPledge_pkey" PRIMARY KEY ("entryId","offerId")
);

-- CreateTable
CREATE TABLE "Chamber" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "whyCare" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL,
    "scaffoldSolving" TEXT NOT NULL,
    "scaffoldNeedToKnow" TEXT NOT NULL,
    "scaffoldSuccess" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "creatorHandle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chamber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamberScaffoldRevision" (
    "id" TEXT NOT NULL,
    "chamberId" TEXT NOT NULL,
    "solving" TEXT NOT NULL,
    "needToKnow" TEXT NOT NULL,
    "success" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamberScaffoldRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamberMember" (
    "id" TEXT NOT NULL,
    "chamberId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamberMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamberInvite" (
    "id" TEXT NOT NULL,
    "chamberId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmKeypair" (
    "profileId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKeyEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmKeypair_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "FellowSoulRequest" (
    "id" TEXT NOT NULL,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FellowSoulRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FellowSoulBond" (
    "id" TEXT NOT NULL,
    "aProfileId" TEXT NOT NULL,
    "bProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FellowSoulBond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmThread" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "initiatorProfileId" TEXT NOT NULL,
    "otherProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'request',
    "initiatorMuted" BOOLEAN NOT NULL DEFAULT false,
    "otherMuted" BOOLEAN NOT NULL DEFAULT false,
    "initiatorDeletedAt" TIMESTAMP(3),
    "otherDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderProfileId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmExcerpt" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "reporterProfileId" TEXT NOT NULL,
    "senderProfileId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DmExcerpt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerProfileId" TEXT NOT NULL,
    "blockedProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedSource" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedSettings" (
    "profileId" TEXT NOT NULL,
    "openLens" BOOLEAN NOT NULL DEFAULT true,
    "balancedDiet" BOOLEAN NOT NULL DEFAULT true,
    "caughtUpAt" TIMESTAMP(3),

    CONSTRAINT "FeedSettings_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasurySnapshot" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "balances" TEXT NOT NULL,
    "inflows" TEXT NOT NULL,
    "outflows" TEXT NOT NULL,

    CONSTRAINT "TreasurySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsAggregate" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "distinct" INTEGER,

    CONSTRAINT "AnalyticsAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Human_credentialHash_key" ON "Human"("credentialHash");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_handle_key" ON "Profile"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_accessKeyHash_key" ON "Profile"("accessKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_humanId_face_key" ON "Profile"("humanId", "face");

-- CreateIndex
CREATE UNIQUE INDEX "SourceObject_url_key" ON "SourceObject"("url");

-- CreateIndex
CREATE UNIQUE INDEX "PostSource_postId_sourceId_key" ON "PostSource"("postId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ValuesAnswer_profileId_questionId_key" ON "ValuesAnswer"("profileId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentAck_profileId_kind_key" ON "ConsentAck"("profileId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEvent_prevHash_key" ON "LedgerEvent"("prevHash");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEvent_entryHash_key" ON "LedgerEvent"("entryHash");

-- CreateIndex
CREATE UNIQUE INDEX "Pillar_slug_key" ON "Pillar"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pillar_position_key" ON "Pillar"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Question_position_key" ON "Question"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Question_pillarId_lens_key" ON "Question"("pillarId", "lens");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_pillarId_position_key" ON "Domain"("pillarId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PictureRevision_repairId_key" ON "PictureRevision"("repairId");

-- CreateIndex
CREATE UNIQUE INDEX "PictureRevision_domainId_version_key" ON "PictureRevision"("domainId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PictureRepair_pollId_key" ON "PictureRepair"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "Discussion_questionId_key" ON "Discussion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Discussion_domainId_key" ON "Discussion"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_pollId_position_key" ON "PollOption"("pollId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_pollId_nullifier_key" ON "Ballot"("pollId", "nullifier");

-- CreateIndex
CREATE UNIQUE INDEX "ModCase_appealOfId_key" ON "ModCase"("appealOfId");

-- CreateIndex
CREATE UNIQUE INDEX "Ruling_caseId_moderatorNullifier_key" ON "Ruling"("caseId", "moderatorNullifier");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeTerm_offerId_key" ON "BadgeTerm"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_profileId_aggregationKey_key" ON "Notification"("profileId", "aggregationKey");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_entryId_attestorProfileId_key" ON "Attestation"("entryId", "attestorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ChamberMember_chamberId_profileId_key" ON "ChamberMember"("chamberId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ChamberInvite_chamberId_profileId_key" ON "ChamberInvite"("chamberId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "FellowSoulBond_aProfileId_bProfileId_key" ON "FellowSoulBond"("aProfileId", "bProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "DmThread_pairKey_key" ON "DmThread"("pairKey");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerProfileId_blockedProfileId_key" ON "Block"("blockerProfileId", "blockedProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSource_profileId_kind_refId_key" ON "FeedSource"("profileId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasurySnapshot_day_key" ON "TreasurySnapshot"("day");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsAggregate_period_name_key" ON "AnalyticsAggregate"("period", "name");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_humanId_fkey" FOREIGN KEY ("humanId") REFERENCES "Human"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSource" ADD CONSTRAINT "PostSource_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSource" ADD CONSTRAINT "PostSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuesAnswer" ADD CONSTRAINT "ValuesAnswer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAck" ADD CONSTRAINT "ConsentAck_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionFace" ADD CONSTRAINT "SessionFace_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SoulSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PillarLock" ADD CONSTRAINT "PillarLock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SoulSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateRequest" ADD CONSTRAINT "GateRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PictureRevision" ADD CONSTRAINT "PictureRevision_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PictureRevision" ADD CONSTRAINT "PictureRevision_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "PictureRepair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PictureRepair" ADD CONSTRAINT "PictureRepair_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallotChoice" ADD CONSTRAINT "BallotChoice_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "Ballot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallotChoice" ADD CONSTRAINT "BallotChoice_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRevision" ADD CONSTRAINT "PostRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_dmExcerptId_fkey" FOREIGN KEY ("dmExcerptId") REFERENCES "DmExcerpt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_dmExcerptId_fkey" FOREIGN KEY ("dmExcerptId") REFERENCES "DmExcerpt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_appealOfId_fkey" FOREIGN KEY ("appealOfId") REFERENCES "ModCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruling" ADD CONSTRAINT "Ruling_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ModCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeTerm" ADD CONSTRAINT "BadgeTerm_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "BadgeOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePurposeRevision" ADD CONSTRAINT "CirclePurposeRevision_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEntry" ADD CONSTRAINT "ActionEntry_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEntry" ADD CONSTRAINT "ActionEntry_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "ActionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ActionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceOffer" ADD CONSTRAINT "ResourceOffer_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEntryPledge" ADD CONSTRAINT "ActionEntryPledge_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ActionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEntryPledge" ADD CONSTRAINT "ActionEntryPledge_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ResourceOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamberScaffoldRevision" ADD CONSTRAINT "ChamberScaffoldRevision_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamberMember" ADD CONSTRAINT "ChamberMember_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamberInvite" ADD CONSTRAINT "ChamberInvite_chamberId_fkey" FOREIGN KEY ("chamberId") REFERENCES "Chamber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmMessage" ADD CONSTRAINT "DmMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DmThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmExcerpt" ADD CONSTRAINT "DmExcerpt_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DmThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CreateTable (Phase 8.6, TESTNET_RAILS_SPEC §6.3)
CREATE TABLE "TestnetWalletLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "cardanoAddress" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestnetWalletLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestnetWalletLink_profileId_key" ON "TestnetWalletLink"("profileId");
