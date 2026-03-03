"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import { createRental, updateRental } from "@/lib/actions/rentals";
import { formatCurrency, toDecimalNumber } from "@/lib/utils";

interface RentalData {
  id: string;
  orderItemId: string | null;
  returnDate: string | null;
  actualReturnDate: string | null;
  deposit: number | string;
}

interface RentalManagerProps {
  orderId: string;
  orderItemId: string | null;
  rental: RentalData | null;
}

export function RentalManager({ orderId, orderItemId, rental }: RentalManagerProps) {
  const [loading, setLoading] = useState(false);

  // Rental dates state
  const [returnDate, setReturnDate] = useState(rental?.returnDate?.split("T")[0] ?? "");
  const [actualReturnDate, setActualReturnDate] = useState(rental?.actualReturnDate?.split("T")[0] ?? "");
  const [deposit, setDeposit] = useState(toDecimalNumber(rental?.deposit));

  async function handleCreateRental() {
    if (!orderItemId) {
      toast.error("No hay ítems disponibles para asociar el alquiler");
      return;
    }
    setLoading(true);
    const result = await createRental({
      orderItemId,
      orderId,
      returnDate: returnDate ? new Date(returnDate) : null,
      deposit,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Alquiler creado");
    } else {
      toast.error(result.error);
    }
  }

  async function handleUpdateRental() {
    if (!rental) return;
    setLoading(true);
    const result = await updateRental(rental.id, {
      returnDate: returnDate ? new Date(returnDate) : null,
      actualReturnDate: actualReturnDate ? new Date(actualReturnDate) : null,
      deposit,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Alquiler actualizado");
    } else {
      toast.error(result.error);
    }
  }

  if (!rental) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">
            Este pedido no tiene un alquiler asociado.
          </p>
          <div className="max-w-md mx-auto space-y-4 text-left">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Devolución</Label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Depósito</Label>
              <MoneyInput value={deposit} onValueChange={(value) => setDeposit(value ?? 0)} />
            </div>
            <Button onClick={handleCreateRental} disabled={loading} className="w-full">
              {loading ? "Creando..." : "Crear Alquiler"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Depósito</div>
          <div className="text-2xl font-bold">{formatCurrency(rental.deposit)}</div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Fechas del Alquiler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha de Devolución</Label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Devolución Real</Label>
              <Input type="date" value={actualReturnDate} onChange={(e) => setActualReturnDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Depósito</Label>
            <MoneyInput value={deposit} onValueChange={(value) => setDeposit(value ?? 0)} />
          </div>
          <Button onClick={handleUpdateRental} disabled={loading}>
            {loading ? "Guardando..." : "Actualizar Alquiler"}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
