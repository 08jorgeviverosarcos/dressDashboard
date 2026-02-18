-- AlterEnum: Change ProductType from DRESS/ACCESSORY/SERVICE to RENTAL/SALE/BOTH
-- All existing products are migrated to BOTH

BEGIN;

-- Step 1: Change column to text to allow dropping the old enum
ALTER TABLE "Product" ALTER COLUMN "type" TYPE TEXT;

-- Step 2: Migrate all existing data to BOTH
UPDATE "Product" SET "type" = 'BOTH';

-- Step 3: Drop old enum
DROP TYPE "ProductType";

-- Step 4: Create new enum with updated values
CREATE TYPE "ProductType" AS ENUM ('RENTAL', 'SALE', 'BOTH');

-- Step 5: Convert column back to the new enum
ALTER TABLE "Product" ALTER COLUMN "type" TYPE "ProductType" USING "type"::"ProductType";

COMMIT;
