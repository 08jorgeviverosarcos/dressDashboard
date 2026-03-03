import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateOrderStatus } from "./orders.service";
import * as repo from "./orders.repo";

vi.mock("./orders.repo", () => ({
  findByIdSimple: vi.fn(),
  findOrderItemsForStockAdjustment: vi.fn(),
  findUnitInventoryItemsForStatusAdjustment: vi.fn(),
  findUnitInventoryItemsForDeliveredStatus: vi.fn(),
  updateStatusInTransaction: vi.fn(),
}));

describe("orders.service.updateOrderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reserva UNIT y decrementa QUANTITY en QUOTE -> CONFIRMED", async () => {
    vi.mocked(repo.findByIdSimple).mockResolvedValue({
      id: "o1",
      status: "QUOTE",
    } as never);
    vi.mocked(repo.findOrderItemsForStockAdjustment).mockResolvedValue([
      { quantity: 2, product: { inventoryItems: [{ id: "q1" }] } },
    ] as never);
    vi.mocked(repo.findUnitInventoryItemsForStatusAdjustment).mockResolvedValue([
      { inventoryItemId: "u1" },
      { inventoryItemId: "u1" },
      { inventoryItemId: "u2" },
    ] as never);
    vi.mocked(repo.updateStatusInTransaction).mockResolvedValue(undefined as never);

    const result = await updateOrderStatus("o1", "CONFIRMED");

    expect(result).toEqual({ success: true, data: undefined });
    expect(repo.updateStatusInTransaction).toHaveBeenCalledWith(
      "o1",
      "CONFIRMED",
      "QUOTE",
      [{ inventoryItemId: "q1", delta: -2 }],
      [
        { inventoryItemId: "u1", status: "RESERVED" },
        { inventoryItemId: "u2", status: "RESERVED" },
      ]
    );
  });

  it("libera UNIT y restaura QUANTITY en * -> CANCELLED", async () => {
    vi.mocked(repo.findByIdSimple).mockResolvedValue({
      id: "o2",
      status: "CONFIRMED",
    } as never);
    vi.mocked(repo.findOrderItemsForStockAdjustment).mockResolvedValue([
      { quantity: 3, product: { inventoryItems: [{ id: "q9" }] } },
    ] as never);
    vi.mocked(repo.findUnitInventoryItemsForStatusAdjustment).mockResolvedValue([
      { inventoryItemId: "u9" },
    ] as never);
    vi.mocked(repo.updateStatusInTransaction).mockResolvedValue(undefined as never);

    const result = await updateOrderStatus("o2", "CANCELLED");

    expect(result).toEqual({ success: true, data: undefined });
    expect(repo.updateStatusInTransaction).toHaveBeenCalledWith(
      "o2",
      "CANCELLED",
      "CONFIRMED",
      [{ inventoryItemId: "q9", delta: 3 }],
      [{ inventoryItemId: "u9", status: "AVAILABLE" }]
    );
  });

  it("marca UNIT como SOLD/RENTED en CONFIRMED -> COMPLETED", async () => {
    vi.mocked(repo.findByIdSimple).mockResolvedValue({
      id: "o3",
      status: "CONFIRMED",
    } as never);
    vi.mocked(repo.findUnitInventoryItemsForDeliveredStatus).mockResolvedValue([
      { inventoryItemId: "u-sale", itemType: "SALE" },
      { inventoryItemId: "u-rental", itemType: "RENTAL" },
    ] as never);
    vi.mocked(repo.updateStatusInTransaction).mockResolvedValue(undefined as never);

    const result = await updateOrderStatus("o3", "COMPLETED");

    expect(result).toEqual({ success: true, data: undefined });
    expect(repo.updateStatusInTransaction).toHaveBeenCalledWith(
      "o3",
      "COMPLETED",
      "CONFIRMED",
      [],
      [
        { inventoryItemId: "u-sale", status: "SOLD" },
        { inventoryItemId: "u-rental", status: "RENTED" },
      ]
    );
  });
});
