-- Update PaymentMethod enum catalog and migrate existing values
-- Mapping confirmed:
-- TRANSFER -> BANCOLOMBIA
-- CARD -> BOLD_CARD
-- CASH -> CASH
-- NEQUI -> NEQUI
-- OTHER -> OTHER

ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";

CREATE TYPE "PaymentMethod" AS ENUM (
  'BANCOLOMBIA',
  'NEQUI',
  'DAVIPLATA',
  'DAVIVIENDA',
  'BOLD_CARD',
  'CREDIBANCO',
  'CASH',
  'OTHER'
);

ALTER TABLE "Payment"
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
  USING (
    CASE
      WHEN "paymentMethod"::text = 'TRANSFER' THEN 'BANCOLOMBIA'
      WHEN "paymentMethod"::text = 'CARD' THEN 'BOLD_CARD'
      ELSE "paymentMethod"::text
    END
  )::"PaymentMethod";

ALTER TABLE "Expense"
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
  USING (
    CASE
      WHEN "paymentMethod"::text = 'TRANSFER' THEN 'BANCOLOMBIA'
      WHEN "paymentMethod"::text = 'CARD' THEN 'BOLD_CARD'
      ELSE "paymentMethod"::text
    END
  )::"PaymentMethod";

DROP TYPE "PaymentMethod_old";
