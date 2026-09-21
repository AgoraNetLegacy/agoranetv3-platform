-- Restore the dual-token signature for Pollinator fees.
--
-- 20260829_unified_pollinator_currency replaced the four dual-token rails
-- with two "unified" rails, making PollCoin and Gratium substitutable and
-- halving a chamber's real cost from 20+20 to 20. That contradicts ratified
-- law: NEURAL_POLLINATOR §3 prices a chamber as a "Micro-fee paid in BOTH
-- PollCoin and Gratium", deliberately, "so active Pollinator souls carry a
-- working stock of both", and ECONOMIC_STARTING_DEFAULTS §1 sets the amount
-- at 20u PC + 20u G. This puts both halves back.
--
-- Historical fee.chamber / fee.chamber-post entries are NOT rewritten: they
-- recorded both halves correctly under the original rule, and they become
-- correct again the moment these rails are restored.
INSERT INTO "Rail" ("key", "value", "unit", "description")
VALUES
  ('chamber.creationFeePc', 20, 'uPC', 'Chamber creation fee, PollCoin half; owner: double a Discussion, and in both tokens (ECONOMIC_STARTING_DEFAULTS §1).'),
  ('chamber.creationFeeG', 20, 'uG', 'Chamber creation fee, Gratium half; the dual-token signature (NEURAL_POLLINATOR §3).'),
  ('chamber.postFeePc', 1, 'uPC', 'Workshop participation micro-fee, PollCoin half; the dual-token signature at micro scale (ECONOMIC_STARTING_DEFAULTS §1).'),
  ('chamber.postFeeG', 1, 'uG', 'Workshop participation micro-fee, Gratium half.')
ON CONFLICT ("key") DO UPDATE SET
  "value" = EXCLUDED."value",
  "unit" = EXCLUDED."unit",
  "description" = EXCLUDED."description";

DELETE FROM "Rail"
WHERE "key" IN ('chamber.creationCost', 'chamber.postCost');
