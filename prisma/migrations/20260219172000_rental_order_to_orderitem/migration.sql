-- Move Rental relation from Order to OrderItem (1:1 optional)
-- Backfill strategy: for each rental, take the first OrderItem by id of its current order

-- 1) Add new optional FK column
ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "orderItemId" TEXT;

-- 2) Backfill existing rentals deterministically from current orderId
UPDATE "Rental" AS r
SET "orderItemId" = (
  SELECT oi."id"
  FROM "OrderItem" AS oi
  WHERE oi."orderId" = r."orderId"
  ORDER BY oi."id" ASC
  LIMIT 1
)
WHERE r."orderId" IS NOT NULL;

-- 3) Add new FK and unique index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Rental_orderItemId_fkey'
  ) THEN
    ALTER TABLE "Rental"
      ADD CONSTRAINT "Rental_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Rental_orderItemId_key" ON "Rental"("orderItemId");

-- 4) Remove old relation to Order
ALTER TABLE "Rental" DROP CONSTRAINT IF EXISTS "Rental_orderId_fkey";
DROP INDEX IF EXISTS "Rental_orderId_key";
ALTER TABLE "Rental" DROP COLUMN IF EXISTS "orderId";
