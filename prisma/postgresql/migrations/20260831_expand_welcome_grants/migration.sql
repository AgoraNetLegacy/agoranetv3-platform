-- Give new profiles enough PC/G runway to explore AgoraNet meaningfully.
-- These rails affect future one-time grants only; existing balances are not
-- silently rewritten.
UPDATE "Rail"
SET "value" = 100,
    "boundMin" = 25,
    "boundMax" = 400,
    "description" = 'Welcome Grant at humanity verification; enough PC for meaningful platform exploration.'
WHERE "key" = 'grant.verification.pc';

UPDATE "Rail"
SET "value" = 100,
    "boundMin" = 25,
    "boundMax" = 400,
    "description" = 'Welcome Grant at humanity verification; enough G for meaningful platform exploration.'
WHERE "key" = 'grant.verification.g';

UPDATE "Rail"
SET "value" = 50,
    "boundMin" = 12.5,
    "boundMax" = 200,
    "description" = 'Hatching grant to a new Alias; enough PC to participate without creating a poverty signal.'
WHERE "key" = 'grant.hatch.pc';

UPDATE "Rail"
SET "value" = 50,
    "boundMin" = 12.5,
    "boundMax" = 200,
    "description" = 'Hatching grant to a new Alias; enough G to participate without creating a poverty signal.'
WHERE "key" = 'grant.hatch.g';
