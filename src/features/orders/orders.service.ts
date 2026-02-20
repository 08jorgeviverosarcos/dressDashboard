import type { ActionResult } from "@/types";
import type { OrderFormData, OrderItemFormData } from "@/lib/validations/order";
import type { OrderStatus } from "@prisma/client";
import { canTransitionTo } from "@/lib/business/status";
import { toDecimalNumber } from "@/lib/utils";
import * as repo from "./orders.repo";
import * as rentalRepo from "@/features/rentals/rentals.repo";

export function getOrders(filters?: { search?: string; status?: OrderStatus }) {
  return repo.findAll(filters);
}

export function getOrder(id: string) {
  return repo.findById(id);
}

export async function createOrder(
  parsed: OrderFormData
): Promise<ActionResult<{ id: string }>> {
  const { items, ...orderData } = parsed;

  const order = await repo.create(orderData, items);

  // Crear Rentals para items tipo RENTAL
  for (const item of items) {
    if (item.itemType === "RENTAL") {
      const createdItem = order.items.find(
        (oi) => oi.productId === item.productId && oi.itemType === "RENTAL"
      );
      if (createdItem) {
        await rentalRepo.create({
          orderItemId: createdItem.id,
          returnDate: item.rentalReturnDate ?? null,
          deposit: 0,
        });
      }
    }
  }

  await repo.createAuditLog({
    entity: "Order",
    entityId: order.id,
    action: "CREATED",
    newValue: "QUOTE",
    orderId: order.id,
  });

  return { success: true, data: { id: order.id } };
}

export async function updateOrder(
  id: string,
  parsed: OrderFormData
): Promise<ActionResult> {
  const { items, ...orderData } = parsed;

  await repo.updateInTransaction(id, orderData, items);

  return { success: true, data: undefined };
}

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<ActionResult> {
  const order = await repo.findByIdSimple(id);
  if (!order) {
    return { success: false, error: "Pedido no encontrado" };
  }

  if (!canTransitionTo(order.status, newStatus)) {
    return {
      success: false,
      error: `No se puede cambiar de ${order.status} a ${newStatus}`,
    };
  }

  await repo.updateStatusInTransaction(id, newStatus, order.status);

  return { success: true, data: undefined };
}

export async function deleteOrder(id: string): Promise<ActionResult> {
  await repo.deleteWithCascade(id);
  return { success: true, data: undefined };
}

export function getOrderItem(id: string) {
  return repo.findOrderItemById(id);
}

export async function updateOrderItem(
  id: string,
  data: OrderItemFormData
): Promise<ActionResult<{ orderId: string }>> {
  const orderItem = await repo.findOrderItemForDeletion(id);
  if (!orderItem) {
    return { success: false, error: "Item no encontrado" };
  }

  const orderId = orderItem.orderId;

  // Calcular subtotal del item actualizado
  const newLineTotal = data.quantity * data.unitPrice;
  const discountVal = data.discountValue ?? 0;
  const newSubtotal =
    data.discountType === "FIXED"
      ? newLineTotal - discountVal
      : data.discountType === "PERCENTAGE"
        ? newLineTotal * (1 - discountVal / 100)
        : newLineTotal;

  // Calcular subtotales de los otros items sin cambios
  const otherItems = orderItem.order.items.filter((i) => i.id !== id);
  let otherSubtotal = 0;
  let otherCost = 0;
  for (const item of otherItems) {
    const lineTotal = item.quantity * toDecimalNumber(item.unitPrice);
    const dv = item.discountValue ? toDecimalNumber(item.discountValue) : 0;
    const sub =
      item.discountType === "FIXED"
        ? lineTotal - dv
        : item.discountType === "PERCENTAGE"
          ? lineTotal * (1 - dv / 100)
          : lineTotal;
    otherSubtotal += sub;
    otherCost += item.quantity * toDecimalNumber(item.costAmount);
  }

  const newTotalPrice =
    otherSubtotal + newSubtotal + toDecimalNumber(orderItem.order.adjustmentAmount);
  const newTotalCost = otherCost + data.quantity * data.costAmount;

  await repo.updateOrderItemInTransaction(
    id,
    orderId,
    {
      productId: data.productId || null,
      inventoryItemId: data.inventoryItemId || null,
      itemType: data.itemType,
      name: data.name,
      description: data.description || null,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      discountType: data.discountType || null,
      discountValue: data.discountValue ?? null,
      costSource: data.costSource,
      costAmount: data.costAmount,
      notes: data.notes || null,
    },
    newTotalPrice,
    newTotalCost
  );

  return { success: true, data: { orderId } };
}

export async function deleteOrderItem(
  id: string
): Promise<ActionResult<{ orderId: string }>> {
  const orderItem = await repo.findOrderItemForDeletion(id);
  if (!orderItem) {
    return { success: false, error: "Item no encontrado" };
  }

  const orderId = orderItem.orderId;
  const rentalId = orderItem.rental?.id ?? null;

  // Calcular nuevos totales excluyendo el item a eliminar
  const remainingItems = orderItem.order.items.filter((i) => i.id !== id);
  let itemsSubtotal = 0;
  let newTotalCost = 0;
  for (const item of remainingItems) {
    const lineTotal = item.quantity * toDecimalNumber(item.unitPrice);
    const discountVal = item.discountValue ? toDecimalNumber(item.discountValue) : 0;
    const subtotal =
      item.discountType === "FIXED"
        ? lineTotal - discountVal
        : item.discountType === "PERCENTAGE"
          ? lineTotal * (1 - discountVal / 100)
          : lineTotal;
    itemsSubtotal += subtotal;
    newTotalCost += item.quantity * toDecimalNumber(item.costAmount);
  }
  const newTotalPrice =
    itemsSubtotal + toDecimalNumber(orderItem.order.adjustmentAmount);

  await repo.deleteOrderItemAndUpdateTotals(
    id,
    orderId,
    rentalId,
    newTotalPrice,
    newTotalCost
  );

  return { success: true, data: { orderId } };
}
