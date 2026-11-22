-- Client decision (#3): Upahar commission is a flat ₹80 per paid installment until the tier table arrives.
-- Data only, and safe to run twice. Changes the Upahar rule only while it is still the empty tier table, and gives ₹80 to the
-- "rate pending" lines that are still unpaid and not on an invoice (only Upahar lines can be "rate pending").
UPDATE "Scheme"
SET "commissionRule" = '{"type": "FLAT", "amount": 8000}'::jsonb
WHERE "code" = 'UPAHAR'
  AND "commissionRule"->>'type' = 'TIER'
  AND jsonb_array_length(COALESCE("commissionRule"->'tiers', '[]'::jsonb)) = 0;

UPDATE "Commission"
SET "amount" = 8000, "ruleMissing" = false
WHERE "ruleMissing" = true AND "status" = 'EARNED' AND "invoiceId" IS NULL;

-- New setting: GST on making charges is 5% (#20).
INSERT INTO "Config" ("key", "value", "updatedAt") VALUES ('makingGstBps', '500'::jsonb, now()) ON CONFLICT ("key") DO NOTHING;
