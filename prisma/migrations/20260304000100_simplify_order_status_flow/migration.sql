-- Simplifica flujo de estados de pedido y migra datos históricos.
-- Estados eliminados: IN_PROGRESS, READY, DELIVERED
-- Mapeo:
--   IN_PROGRESS -> CONFIRMED
--   READY -> CONFIRMED
--   DELIVERED -> COMPLETED

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM ('QUOTE', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

UPDATE "Order"
SET "status" = 'CONFIRMED'
WHERE "status" IN ('IN_PROGRESS', 'READY');

UPDATE "Order"
SET "status" = 'COMPLETED'
WHERE "status" = 'DELIVERED';

ALTER TABLE "Order"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order"
ALTER COLUMN "status" TYPE "OrderStatus"
USING ("status"::text::"OrderStatus");

ALTER TABLE "Order"
ALTER COLUMN "status" SET DEFAULT 'QUOTE';

DROP TYPE "OrderStatus_old";
