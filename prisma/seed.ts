import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.rentalCost.deleteMany();
  await prisma.rental.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();

  // ─── Clients ───────────────────────────────────────
  const client1 = await prisma.client.create({
    data: {
      name: "María García López",
      phone: "+57 310 555 1234",
      email: "maria.garcia@email.com",
      notes: "Cliente frecuente, prefiere colores oscuros",
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: "Laura Martínez Rojas",
      phone: "+57 315 555 5678",
      email: "laura.martinez@email.com",
    },
  });

  const client3 = await prisma.client.create({
    data: {
      name: "Carolina Díaz Pérez",
      phone: "+57 320 555 9012",
      email: "carolina.diaz@email.com",
      notes: "Quinceañera - hija Valentina",
    },
  });

  const client4 = await prisma.client.create({
    data: {
      name: "Sofía Hernández",
      phone: "+57 301 555 3456",
    },
  });

  // ─── Products ──────────────────────────────────────
  const dress1 = await prisma.product.create({
    data: {
      code: "VG-001",
      name: "Vestido Gala Esmeralda",
      type: "DRESS",
      category: "GALA",
      salePrice: 2500000,
      rentalPrice: 800000,
      cost: 900000,
      description: "Vestido largo de gala color esmeralda con pedrería",
    },
  });

  const dress2 = await prisma.product.create({
    data: {
      code: "VN-001",
      name: "Vestido Novia Clásico",
      type: "DRESS",
      category: "BRIDE",
      salePrice: 5000000,
      rentalPrice: 1500000,
      cost: 1800000,
      description: "Vestido de novia clásico con encaje francés",
    },
  });

  const dress3 = await prisma.product.create({
    data: {
      code: "VC-001",
      name: "Vestido Coctel Rosa",
      type: "DRESS",
      category: "COCKTAIL",
      salePrice: 1200000,
      rentalPrice: 400000,
      cost: 450000,
      description: "Vestido corto de coctel color rosa pastel",
    },
  });

  const dress4 = await prisma.product.create({
    data: {
      code: "VQ-001",
      name: "Vestido Quinceañera Princesa",
      type: "DRESS",
      category: "QUINCEANERA",
      salePrice: 3500000,
      rentalPrice: 1200000,
      cost: 1300000,
      description: "Vestido de quinceañera estilo princesa con falda amplia",
    },
  });

  const accessory1 = await prisma.product.create({
    data: {
      code: "AC-001",
      name: "Tiara Cristal",
      type: "ACCESSORY",
      category: "OTHER",
      salePrice: 350000,
      cost: 120000,
      description: "Tiara con cristales Swarovski",
    },
  });

  const service1 = await prisma.product.create({
    data: {
      code: "SV-001",
      name: "Ajuste y arreglo",
      type: "SERVICE",
      salePrice: 200000,
      cost: 80000,
      description: "Servicio de ajuste a medida",
    },
  });

  // ─── Inventory ─────────────────────────────────────
  const inv1 = await prisma.inventoryItem.create({
    data: {
      productId: dress1.id,
      quantityOnHand: 2,
      status: "AVAILABLE",
      usageCount: 3,
    },
  });

  const inv2 = await prisma.inventoryItem.create({
    data: {
      productId: dress2.id,
      quantityOnHand: 1,
      status: "AVAILABLE",
      usageCount: 0,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      productId: dress3.id,
      quantityOnHand: 3,
      status: "AVAILABLE",
      usageCount: 5,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      productId: dress4.id,
      quantityOnHand: 1,
      status: "AVAILABLE",
      usageCount: 1,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      productId: accessory1.id,
      quantityOnHand: 5,
      status: "AVAILABLE",
      usageCount: 0,
    },
  });

  // ─── Orders ────────────────────────────────────────

  // Order 1: Completed sale
  const order1 = await prisma.order.create({
    data: {
      clientId: client1.id,
      status: "COMPLETED",
      orderDate: new Date("2025-01-15"),
      eventDate: new Date("2025-03-20"),
      deliveryDate: new Date("2025-03-15"),
      totalPrice: 2700000,
      totalCost: 980000,
      minDownpaymentPct: 30,
      notes: "Venta vestido gala + ajustes",
      items: {
        create: [
          {
            productId: dress1.id,
            inventoryItemId: inv1.id,
            quantity: 1,
            unitPrice: 2500000,
            costSource: "INVENTORY",
            costAmount: 900000,
          },
          {
            productId: service1.id,
            quantity: 1,
            unitPrice: 200000,
            costSource: "MANUAL",
            costAmount: 80000,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentDate: new Date("2025-01-15"),
            amount: 810000,
            paymentType: "DOWNPAYMENT",
            paymentMethod: "TRANSFER",
            reference: "TRF-001",
            notes: "Abono inicial 30%",
          },
          {
            paymentDate: new Date("2025-02-15"),
            amount: 1000000,
            paymentType: "INSTALLMENT",
            paymentMethod: "NEQUI",
            reference: "NQ-001",
          },
          {
            paymentDate: new Date("2025-03-10"),
            amount: 890000,
            paymentType: "FINAL",
            paymentMethod: "CASH",
            notes: "Pago final en efectivo",
          },
        ],
      },
    },
  });

  // Order 2: In progress (rental)
  const order2 = await prisma.order.create({
    data: {
      clientId: client2.id,
      status: "IN_PROGRESS",
      orderDate: new Date("2025-02-01"),
      eventDate: new Date("2025-04-15"),
      totalPrice: 1500000,
      totalCost: 300000,
      minDownpaymentPct: 30,
      notes: "Alquiler vestido novia",
      items: {
        create: [
          {
            productId: dress2.id,
            inventoryItemId: inv2.id,
            quantity: 1,
            unitPrice: 1500000,
            costSource: "INVENTORY",
            costAmount: 300000,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentDate: new Date("2025-02-01"),
            amount: 500000,
            paymentType: "DOWNPAYMENT",
            paymentMethod: "TRANSFER",
            reference: "TRF-002",
          },
        ],
      },
      rental: {
        create: {
          pickupDate: new Date("2025-04-12"),
          returnDate: new Date("2025-04-17"),
          chargedIncome: 1500000,
        },
      },
    },
  });

  // Order 3: Quote (quinceañera)
  await prisma.order.create({
    data: {
      clientId: client3.id,
      status: "QUOTE",
      orderDate: new Date("2025-02-10"),
      eventDate: new Date("2025-06-20"),
      totalPrice: 3850000,
      totalCost: 1420000,
      minDownpaymentPct: 30,
      notes: "Quinceañera Valentina - vestido + tiara",
      items: {
        create: [
          {
            productId: dress4.id,
            quantity: 1,
            unitPrice: 3500000,
            costSource: "INVENTORY",
            costAmount: 1300000,
          },
          {
            productId: accessory1.id,
            quantity: 1,
            unitPrice: 350000,
            costSource: "INVENTORY",
            costAmount: 120000,
          },
        ],
      },
    },
  });

  // Order 4: Confirmed
  await prisma.order.create({
    data: {
      clientId: client4.id,
      status: "CONFIRMED",
      orderDate: new Date("2025-02-12"),
      eventDate: new Date("2025-05-10"),
      deliveryDate: new Date("2025-05-05"),
      totalPrice: 1200000,
      totalCost: 450000,
      minDownpaymentPct: 30,
      notes: "Vestido coctel para boda",
      items: {
        create: [
          {
            productId: dress3.id,
            quantity: 1,
            unitPrice: 1200000,
            costSource: "INVENTORY",
            costAmount: 450000,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentDate: new Date("2025-02-12"),
            amount: 400000,
            paymentType: "DOWNPAYMENT",
            paymentMethod: "NEQUI",
            reference: "NQ-002",
            notes: "Abono para confirmar",
          },
        ],
      },
    },
  });

  // ─── Expenses ──────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        date: new Date("2025-01-05"),
        category: "Materiales",
        subcategory: "Telas",
        description: "Compra tela seda italiana - 20 metros",
        responsible: "Ana María",
        amount: 1200000,
        expenseType: "VARIABLE",
        paymentMethod: "TRANSFER",
      },
      {
        date: new Date("2025-01-15"),
        category: "Operaciones",
        subcategory: "Arriendo local",
        description: "Arriendo mes de enero",
        responsible: "Admin",
        amount: 3500000,
        expenseType: "FIXED",
        paymentMethod: "TRANSFER",
      },
      {
        date: new Date("2025-01-20"),
        category: "Mano de obra",
        subcategory: "Costura",
        description: "Confección vestido gala esmeralda",
        responsible: "Carmen",
        amount: 450000,
        expenseType: "VARIABLE",
        paymentMethod: "CASH",
        orderId: order1.id,
      },
      {
        date: new Date("2025-02-01"),
        category: "Logística",
        subcategory: "Lavandería",
        description: "Lavado en seco vestidos alquiler",
        responsible: "Admin",
        amount: 180000,
        expenseType: "VARIABLE",
        paymentMethod: "CASH",
      },
      {
        date: new Date("2025-02-05"),
        category: "Marketing",
        subcategory: "Redes sociales",
        description: "Pauta publicitaria Instagram febrero",
        responsible: "Marketing",
        amount: 500000,
        expenseType: "VARIABLE",
        paymentMethod: "CARD",
      },
      {
        date: new Date("2025-02-15"),
        category: "Operaciones",
        subcategory: "Arriendo local",
        description: "Arriendo mes de febrero",
        responsible: "Admin",
        amount: 3500000,
        expenseType: "FIXED",
        paymentMethod: "TRANSFER",
      },
      {
        date: new Date("2025-02-10"),
        category: "Materiales",
        subcategory: "Pedrería y apliques",
        description: "Piedras Swarovski para vestido novia",
        responsible: "Ana María",
        amount: 800000,
        expenseType: "VARIABLE",
        paymentMethod: "CARD",
        orderId: order2.id,
      },
    ],
  });

  // ─── Audit Logs ────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      entity: "Order",
      entityId: order1.id,
      action: "STATUS_CHANGE",
      oldValue: "DELIVERED",
      newValue: "COMPLETED",
      orderId: order1.id,
      metadata: { reason: "Pago completo recibido" },
    },
  });

  console.log("✅ Seed data created successfully!");
  console.log(`   - 4 clientes`);
  console.log(`   - 6 productos`);
  console.log(`   - 5 items de inventario`);
  console.log(`   - 4 pedidos con items y pagos`);
  console.log(`   - 7 gastos`);
  console.log(`   - 1 alquiler`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
