/* prisma_import.ts
   Importa los JSON generados por export_excel_to_json.py hacia Postgres usando Prisma.
   Uso:
     pnpm tsx prisma_import.ts --dir ./data
*/
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

type Args = { dir: string };
type JsonRecord = Record<string, unknown>;
function parseArgs(): Args {
  const idx = process.argv.indexOf("--dir");
  if (idx === -1 || !process.argv[idx + 1]) throw new Error("Uso: --dir <carpeta>");
  return { dir: process.argv[idx + 1] };
}
function readJson<T>(dir: string, name: string): T {
  const p = path.join(dir, `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function asDecimal(x: unknown): string | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return x.toFixed(2);
  if (typeof x === "string") return x;
  return String(x);
}

function asDate(x: unknown): Date | undefined {
  if (x === null || x === undefined || x === "") return undefined;
  const d = x instanceof Date ? x : new Date(String(x));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function asNullableDate(x: unknown): Date | null {
  if (x === null || x === undefined || x === "") return null;
  const d = x instanceof Date ? x : new Date(String(x));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeOrderStatus(status: unknown): string {
  const value = String(status ?? "QUOTE");
  if (value === "IN_PROGRESS" || value === "READY") return "CONFIRMED";
  if (value === "DELIVERED") return "COMPLETED";
  return value;
}

async function main() {
  const { dir } = parseArgs();

  const clients = readJson<JsonRecord[]>(dir, "clients");
  const categories = readJson<JsonRecord[]>(dir, "categories");
  const products = readJson<JsonRecord[]>(dir, "products");
  const inventoryItems = readJson<JsonRecord[]>(dir, "inventoryItems");
  const orders = readJson<JsonRecord[]>(dir, "orders");
  const orderItems = readJson<JsonRecord[]>(dir, "orderItems");
  const rentals = readJson<JsonRecord[]>(dir, "rentals");
  const payments = readJson<JsonRecord[]>(dir, "payments");
  const expenses = readJson<JsonRecord[]>(dir, "expenses");

  await prisma.$transaction(async (tx) => {
    if (categories.length) {
      await tx.category.createMany({
        data: categories as Prisma.CategoryCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (products.length) {
      await tx.product.createMany({
        data: products.map((p) => ({
          ...p,
          salePrice: asDecimal(p.salePrice),
          rentalPrice: asDecimal(p.rentalPrice),
          cost: asDecimal(p.cost),
        })) as Prisma.ProductCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (inventoryItems.length) {
      await tx.inventoryItem.createMany({
        data: inventoryItems.map((item) => ({
          ...item,
          acquiredAt: asDate(item.acquiredAt),
        })) as Prisma.InventoryItemCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (clients.length) {
      await tx.client.createMany({
        data: clients as Prisma.ClientCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (orders.length) {
      await tx.order.createMany({
        data: orders.map((o) => ({
          ...o,
          status: normalizeOrderStatus(o.status),
          orderDate: asDate(o.orderDate),
          eventDate: asNullableDate(o.eventDate),
          deliveryDate: asNullableDate(o.deliveryDate),
          totalPrice: asDecimal(o.totalPrice),
          totalCost: asDecimal(o.totalCost),
          adjustmentAmount: asDecimal(o.adjustmentAmount),
          minDownpaymentPct: asDecimal(o.minDownpaymentPct),
        })) as Prisma.OrderCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (orderItems.length) {
      await tx.orderItem.createMany({
        data: orderItems.map((oi) => ({
          ...oi,
          unitPrice: asDecimal(oi.unitPrice),
          discountValue: asDecimal(oi.discountValue),
          costAmount: asDecimal(oi.costAmount),
        })) as Prisma.OrderItemCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (rentals.length) {
      await tx.rental.createMany({
        data: rentals.map((r) => ({
          ...r,
          returnDate: asNullableDate(r.returnDate),
          actualReturnDate: asNullableDate(r.actualReturnDate),
          deposit: asDecimal(r.deposit),
        })) as Prisma.RentalCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (payments.length) {
      await tx.payment.createMany({
        data: payments.map((p) => ({
          ...p,
          paymentDate: asDate(p.paymentDate),
          amount: asDecimal(p.amount),
        })) as Prisma.PaymentCreateManyInput[],
        skipDuplicates: true,
      });
    }

    if (expenses.length) {
      await tx.expense.createMany({
        data: expenses.map((e) => ({
          ...e,
          date: asDate(e.date),
          amount: asDecimal(e.amount),
        })) as Prisma.ExpenseCreateManyInput[],
        skipDuplicates: true,
      });
    }
  });

  console.log("✅ Import terminado.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


//   BEGIN;

// TRUNCATE TABLE
//   "AuditLog",
//   "Rental",
//   "Expense",
//   "Payment",
//   "OrderItem",
//   "Order",
//   "InventoryItem",
//   "Product",
//   "Category",
//   "Client"
// RESTART IDENTITY CASCADE;

// COMMIT;