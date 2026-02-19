-- Move Expense relation from Order to OrderItem
-- Existing expenses with orderId are left with orderItemId = NULL (no data loss)

-- Drop existing FK and index for orderId
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_orderId_fkey";
DROP INDEX "Expense_orderId_idx";

-- Remove orderId column
ALTER TABLE "Expense" DROP COLUMN "orderId";

-- Add orderItemId column
ALTER TABLE "Expense" ADD COLUMN "orderItemId" TEXT;

-- Add FK to OrderItem (SET NULL when OrderItem is deleted)
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index
CREATE INDEX "Expense_orderItemId_idx" ON "Expense"("orderItemId");
