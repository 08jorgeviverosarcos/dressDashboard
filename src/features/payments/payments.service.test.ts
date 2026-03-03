import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPayment } from "./payments.service";
import * as repo from "./payments.repo";
import * as ordersService from "@/features/orders/orders.service";

vi.mock("./payments.repo", () => ({
  findAll: vi.fn(),
  findByIdWithOrder: vi.fn(),
  findOrderWithPayments: vi.fn(),
  createPayment: vi.fn(),
  createPaymentAuditLog: vi.fn(),
  findById: vi.fn(),
  deleteById: vi.fn(),
}));

vi.mock("@/features/orders/orders.service", () => ({
  updateOrderStatus: vi.fn(),
}));

describe("payments.service.createPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa orders.service.updateOrderStatus cuando pago confirma pedido", async () => {
    vi.mocked(repo.findOrderWithPayments).mockResolvedValue({
      id: "o1",
      status: "QUOTE",
      totalPrice: 1000,
      minDownpaymentPct: 30,
      payments: [],
    } as never);
    vi.mocked(repo.createPayment).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(ordersService.updateOrderStatus).mockResolvedValue({
      success: true,
      data: undefined,
    });
    vi.mocked(repo.createPaymentAuditLog).mockResolvedValue(undefined as never);

    const result = await createPayment({
      orderId: "o1",
      paymentDate: new Date("2026-03-03"),
      amount: 300,
      paymentType: "DOWNPAYMENT",
      paymentMethod: "CASH",
      reference: "",
      notes: "",
    });

    expect(result).toEqual({ success: true, data: { id: "p1" } });
    expect(ordersService.updateOrderStatus).toHaveBeenCalledWith("o1", "CONFIRMED");
    expect(repo.createPaymentAuditLog).toHaveBeenCalledWith(
      "p1",
      "o1",
      "CASH",
      "DOWNPAYMENT",
      300
    );
  });

  it("propaga error si updateOrderStatus falla", async () => {
    vi.mocked(repo.findOrderWithPayments).mockResolvedValue({
      id: "o2",
      status: "QUOTE",
      totalPrice: 1000,
      minDownpaymentPct: 30,
      payments: [],
    } as never);
    vi.mocked(repo.createPayment).mockResolvedValue({ id: "p2" } as never);
    vi.mocked(ordersService.updateOrderStatus).mockResolvedValue({
      success: false,
      error: "No se puede cambiar de QUOTE a CONFIRMED",
    });

    const result = await createPayment({
      orderId: "o2",
      paymentDate: new Date("2026-03-03"),
      amount: 300,
      paymentType: "DOWNPAYMENT",
      paymentMethod: "CASH",
      reference: "",
      notes: "",
    });

    expect(result).toEqual({
      success: false,
      error: "No se puede cambiar de QUOTE a CONFIRMED",
    });
    expect(repo.createPaymentAuditLog).not.toHaveBeenCalled();
  });
});
