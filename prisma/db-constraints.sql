-- Run as a custom migration after the initial `prisma migrate dev`:
--   npx prisma migrate dev --create-only --name ledger_immutability
-- then paste this into the generated migration.sql and apply.

-- 1. Block UPDATE and DELETE on the ledger for everyone, including the app role.
CREATE OR REPLACE FUNCTION points_ledger_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'points_ledger is append-only; create a REVERSAL row instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER points_ledger_no_update
  BEFORE UPDATE OR DELETE ON "PointsLedger"
  FOR EACH ROW EXECUTE FUNCTION points_ledger_block_mutation();

-- 2. Sanity constraints
ALTER TABLE "PointsLedger"
  ADD CONSTRAINT ledger_sign_check CHECK (
    (type = 'AWARD' AND points > 0) OR
    (type = 'REDEMPTION_HOLD' AND points < 0) OR
    (type = 'REVERSAL' AND points <> 0)
  );

ALTER TABLE "PointsLedger"
  ADD CONSTRAINT ledger_reversal_needs_reason CHECK (
    type <> 'REVERSAL' OR (reason IS NOT NULL AND length(trim(reason)) > 0 AND "reversesId" IS NOT NULL)
  );

ALTER TABLE "PointsLedger"
  ADD CONSTRAINT ledger_award_needs_collection CHECK (
    type <> 'AWARD' OR "collectionId" IS NOT NULL
  );

-- 3. Collection score must be one of the approved values
ALTER TABLE "Collection"
  ADD CONSTRAINT collection_score_check CHECK (score IN (0, 5, 10));

-- Note: a rejected redemption is reversed with a REVERSAL row (+points) pointing at the HOLD row.
-- Prevent overspending in the service layer: inside one transaction, lock the household row
-- (SELECT ... FOR UPDATE), compute SUM(points), and only then insert the HOLD.

-- 4. Every account needs a way to sign in
ALTER TABLE "User"
  ADD CONSTRAINT user_has_login_id CHECK (email IS NOT NULL OR phone IS NOT NULL);
