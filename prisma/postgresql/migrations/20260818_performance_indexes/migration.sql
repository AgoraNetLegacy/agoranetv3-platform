-- Launch-readiness indexes for the persistent shell, expiry sweeps,
-- public feeds, and identity-scoped social surfaces. These add no columns
-- and change no privacy or identity semantics.
CREATE INDEX IF NOT EXISTS "Profile_status_activateAt_idx" ON "Profile"("status", "activateAt");
CREATE INDEX IF NOT EXISTS "PostSource_createdAt_idx" ON "PostSource"("createdAt");
CREATE INDEX IF NOT EXISTS "SoulSession_expiresAt_idx" ON "SoulSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "PillarLock_lastActiveAt_idx" ON "PillarLock"("lastActiveAt");
CREATE INDEX IF NOT EXISTS "GateRequest_scope_status_idx" ON "GateRequest"("scope", "status");
CREATE INDEX IF NOT EXISTS "Discussion_pillarId_createdAt_idx" ON "Discussion"("pillarId", "createdAt");
CREATE INDEX IF NOT EXISTS "Discussion_circleId_idx" ON "Discussion"("circleId");
CREATE INDEX IF NOT EXISTS "Discussion_chamberId_idx" ON "Discussion"("chamberId");
CREATE INDEX IF NOT EXISTS "Poll_status_nominalCloseAt_idx" ON "Poll"("status", "nominalCloseAt");
CREATE INDEX IF NOT EXISTS "Poll_visibilityScope_status_createdAt_idx" ON "Poll"("visibilityScope", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Post_discussionId_status_createdAt_idx" ON "Post"("discussionId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Post_authorProfileId_createdAt_idx" ON "Post"("authorProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "Post_status_createdAt_idx" ON "Post"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "BadgeOffer_profileId_status_expiresAt_idx" ON "BadgeOffer"("profileId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "BadgeTerm_profileId_endsAt_idx" ON "BadgeTerm"("profileId", "endsAt");
CREATE INDEX IF NOT EXISTS "Notification_profileId_readAt_updatedAt_idx" ON "Notification"("profileId", "readAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "CircleMember_profileId_leftAt_idx" ON "CircleMember"("profileId", "leftAt");
CREATE INDEX IF NOT EXISTS "CircleMember_circleId_leftAt_idx" ON "CircleMember"("circleId", "leftAt");
CREATE INDEX IF NOT EXISTS "ChamberMember_profileId_idx" ON "ChamberMember"("profileId");
CREATE INDEX IF NOT EXISTS "FellowSoulRequest_toProfileId_status_createdAt_idx" ON "FellowSoulRequest"("toProfileId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "FellowSoulRequest_status_createdAt_idx" ON "FellowSoulRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "FellowSoulBond_aProfileId_idx" ON "FellowSoulBond"("aProfileId");
CREATE INDEX IF NOT EXISTS "FellowSoulBond_bProfileId_idx" ON "FellowSoulBond"("bProfileId");
