import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Models that support soft delete (have deletedAt field)
const SOFT_DELETE_MODELS = new Set([
  "Client",
  "Category",
  "Product",
  "InventoryItem",
  "Order",
  "OrderItem",
  "Payment",
  "Expense",
  "Rental",
  "RentalCost",
]);

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async findMany(ctx: any) {
          if (SOFT_DELETE_MODELS.has(ctx.model) && ctx.args.where?.deletedAt === undefined) {
            ctx.args.where = { ...ctx.args.where, deletedAt: null };
          }
          return ctx.query(ctx.args);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async findFirst(ctx: any) {
          if (SOFT_DELETE_MODELS.has(ctx.model) && ctx.args.where?.deletedAt === undefined) {
            ctx.args.where = { ...ctx.args.where, deletedAt: null };
          }
          return ctx.query(ctx.args);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async count(ctx: any) {
          if (SOFT_DELETE_MODELS.has(ctx.model) && ctx.args.where?.deletedAt === undefined) {
            ctx.args.where = { ...ctx.args.where, deletedAt: null };
          }
          return ctx.query(ctx.args);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async aggregate(ctx: any) {
          if (SOFT_DELETE_MODELS.has(ctx.model) && ctx.args.where?.deletedAt === undefined) {
            ctx.args.where = { ...ctx.args.where, deletedAt: null };
          }
          return ctx.query(ctx.args);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async groupBy(ctx: any) {
          if (SOFT_DELETE_MODELS.has(ctx.model) && ctx.args.where?.deletedAt === undefined) {
            ctx.args.where = { ...ctx.args.where, deletedAt: null };
          }
          return ctx.query(ctx.args);
        },
      },
    },
  });
}

type PrismaClientExtended = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientExtended | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
