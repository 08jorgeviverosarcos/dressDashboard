/*
  Warnings:

  - You are about to drop the column `chargedIncome` on the `Rental` table. All the data in the column will be lost.
  - You are about to drop the column `pickupDate` on the `Rental` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "adjustmentReason" TEXT;

-- AlterTable
ALTER TABLE "Rental" DROP COLUMN "chargedIncome",
DROP COLUMN "pickupDate",
ADD COLUMN     "deposit" DECIMAL(12,2) NOT NULL DEFAULT 0;
