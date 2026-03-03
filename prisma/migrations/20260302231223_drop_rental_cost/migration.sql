/*
  Warnings:

  - You are about to drop the `RentalCost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RentalCost" DROP CONSTRAINT "RentalCost_rentalId_fkey";

-- DropTable
DROP TABLE "RentalCost";
