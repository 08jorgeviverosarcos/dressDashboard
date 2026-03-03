import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateRental } from "./rentals.service";
import * as repo from "./rentals.repo";

vi.mock("./rentals.repo", () => ({
  findByOrderItemId: vi.fn(),
  findByOrderItemIdSimple: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  updateInventoryItemOnReturn: vi.fn(),
  update: vi.fn(),
}));

describe("rentals.service.updateRental", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("al registrar devolución real libera inventario (compatible con RESERVED)", async () => {
    vi.mocked(repo.findById).mockResolvedValue({
      id: "r1",
      actualReturnDate: null,
      orderItem: {
        orderId: "o1",
        order: {
          items: [{ inventoryItem: { id: "inv-1" } }],
        },
      },
    } as never);
    vi.mocked(repo.updateInventoryItemOnReturn).mockResolvedValue(undefined as never);
    vi.mocked(repo.update).mockResolvedValue(undefined as never);

    const result = await updateRental("r1", {
      actualReturnDate: new Date("2026-03-03"),
    });

    expect(result).toEqual({ success: true, orderId: "o1" });
    expect(repo.updateInventoryItemOnReturn).toHaveBeenCalledWith("inv-1");
    expect(repo.update).toHaveBeenCalledWith("r1", {
      actualReturnDate: new Date("2026-03-03"),
    });
  });
});
