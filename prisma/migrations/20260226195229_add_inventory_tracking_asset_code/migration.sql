-- CreateEnum
CREATE TYPE "InventoryTracking" AS ENUM ('UNIT', 'QUANTITY');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "inventoryTracking" "InventoryTracking" NOT NULL DEFAULT 'QUANTITY';

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "assetCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_assetCode_key" ON "InventoryItem"("assetCode");

-- CreateIndex
CREATE INDEX "InventoryItem_assetCode_idx" ON "InventoryItem"("assetCode");
