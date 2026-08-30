-- Neural Pollinator participation uses one canonical PC/G balance.
-- PC and G convert 1:1; the ledger still records the source currency.
INSERT INTO "Rail" ("key", "value", "unit", "boundMin", "boundMax", "description")
VALUES
  ('chamber.creationCost', 20, 'u', 5, 80, 'Chamber creation participation cost; PC and G count 1:1 toward one unified balance.'),
  ('chamber.postCost', 2, 'u', 0.5, 8, 'Workshop participation cost; PC and G count 1:1 toward one unified balance.')
ON CONFLICT ("key") DO UPDATE SET
  "value" = EXCLUDED."value",
  "unit" = EXCLUDED."unit",
  "boundMin" = EXCLUDED."boundMin",
  "boundMax" = EXCLUDED."boundMax",
  "description" = EXCLUDED."description";

DELETE FROM "Rail"
WHERE "key" IN (
  'chamber.creationFeePc',
  'chamber.creationFeeG',
  'chamber.postFeePc',
  'chamber.postFeeG'
);
