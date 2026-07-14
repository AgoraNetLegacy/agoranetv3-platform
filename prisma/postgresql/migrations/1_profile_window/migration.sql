-- Phase 8.5 (PRESENTATION_SPEC §5.1–5.2): the per-face profile window
-- (live-surface bio + self-placed place) and the face-switch animation
-- settings choice. Additive only; nothing existing changes shape.
ALTER TABLE "Profile" ADD COLUMN "bio" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "bioPlace" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Profile" ADD COLUMN "switchAnimation" TEXT NOT NULL DEFAULT 'flip';
