"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { createRental, updateRental, addRentalCost, deleteRentalCost } from "@/lib/actions/rentals";
import { RENTAL_COST_TYPES } from "@/lib/constants/categories";
import { formatCurrency, toDecimalNumber } from "@/lib/utils";
import { calculateRentalProfit } from "@/lib/business/profit";
import { Plus, Trash2, DollarSign } from "lucide-react";

interface RentalCost {
  id: string;
  type: string;
  amount: number | string;
  description: string | null;
}

interface RentalData {
  id: string;
  orderItemId: string | null;
  pickupDate: string | null;
  returnDate: string | null;
  actualReturnDate: string | null;
  chargedIncome: number | string;
  costs: RentalCost[];
}

interface RentalManagerProps {
  orderId: string;
  orderItemId: string | null;
  rental: RentalData | null;
  orderTotal: number;
}

export function RentalManager({ orderId, orderItemId, rental, orderTotal }: RentalManagerProps) {
  const [loading, setLoading] = useState(false);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Cost form state
  const [costType, setCostType] = useState(RENTAL_COST_TYPES[0]);
  const [costAmount, setCostAmount] = useState(0);
  const [costDescription, setCostDescription] = useState("");

  // Rental dates state
  const [pickupDate, setPickupDate] = useState(rental?.pickupDate?.split("T")[0] ?? "");
  const [returnDate, setReturnDate] = useState(rental?.returnDate?.split("T")[0] ?? "");
  const [actualReturnDate, setActualReturnDate] = useState(rental?.actualReturnDate?.split("T")[0] ?? "");
  const [chargedIncome, setChargedIncome] = useState(toDecimalNumber(rental?.chargedIncome));

  const totalCosts = rental?.costs.reduce((sum, c) => sum + toDecimalNumber(c.amount), 0) ?? 0;
  const profit = rental ? calculateRentalProfit(rental.chargedIncome, rental.costs.map(c => ({ amount: c.amount }))) : 0;

  async function handleCreateRental() {
    if (!orderItemId) {
      toast.error("No hay ítems disponibles para asociar el alquiler");
      return;
    }
    setLoading(true);
    const result = await createRental({
      orderItemId,
      orderId,
      pickupDate: pickupDate ? new Date(pickupDate) : null,
      returnDate: returnDate ? new Date(returnDate) : null,
      chargedIncome: chargedIncome || orderTotal,
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
      pickupDate: pickupDate ? new Date(pickupDate) : null,
      returnDate: returnDate ? new Date(returnDate) : null,
      actualReturnDate: actualReturnDate ? new Date(actualReturnDate) : null,
      chargedIncome,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Alquiler actualizado");
    } else {
      toast.error(result.error);
    }
  }

  async function handleAddCost() {
    if (!rental) return;
    setLoading(true);
    const result = await addRentalCost({
      rentalId: rental.id,
      type: costType,
      amount: costAmount,
      description: costDescription || undefined,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Costo agregado");
      setCostDialogOpen(false);
      setCostAmount(0);
      setCostDescription("");
    } else {
      toast.error(result.error);
    }
  }

  async function handleDeleteCost() {
    if (!deleteTarget) return;
    setLoading(true);
    const result = await deleteRentalCost(deleteTarget);
    setLoading(false);
    if (result.success) {
      toast.success("Costo eliminado");
      setDeleteTarget(null);
    } else {
      toast.error(result.error);
      setDeleteTarget(null);
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Recogida</Label>
                <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Devolución</Label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ingreso Cobrado</Label>
              <Input type="number" value={chargedIncome} onChange={(e) => setChargedIncome(Number(e.target.value))} />
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
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Ingreso Cobrado
            </div>
            <div className="text-2xl font-bold">{formatCurrency(rental.chargedIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Costos</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalCosts)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Ganancia Alquiler</div>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(profit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Fechas del Alquiler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Fecha de Recogida</Label>
              <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
            </div>
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
            <Label>Ingreso Cobrado</Label>
            <Input type="number" value={chargedIncome} onChange={(e) => setChargedIncome(Number(e.target.value))} />
          </div>
          <Button onClick={handleUpdateRental} disabled={loading}>
            {loading ? "Guardando..." : "Actualizar Alquiler"}
          </Button>
        </CardContent>
      </Card>

      {/* Costs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Costos del Alquiler ({rental.costs.length})</CardTitle>
            <Button size="sm" onClick={() => setCostDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Costo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rental.costs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin costos registrados</p>
          ) : (
            <div className="space-y-2">
              {rental.costs.map((cost) => (
                <div key={cost.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <span className="font-medium">{cost.type}</span>
                    {cost.description && (
                      <span className="text-sm text-muted-foreground ml-2">— {cost.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCurrency(cost.amount)}</span>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cost.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-end font-bold">
                Total: {formatCurrency(totalCosts)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Cost Dialog */}
      <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Costo de Alquiler</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={costType} onValueChange={setCostType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RENTAL_COST_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input type="number" value={costAmount} onChange={(e) => setCostAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={costDescription} onChange={(e) => setCostDescription(e.target.value)} placeholder="Descripción opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCost} disabled={loading || costAmount <= 0}>
              {loading ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar costo"
        description="¿Estás seguro de eliminar este costo?"
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDeleteCost}
        loading={loading}
      />
    </div>
  );
}
