"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import {
  EntitySelectorModal,
  type EntitySelectorColumn,
} from "@/components/shared/EntitySelectorModal";
import { ProductQuickForm } from "@/features/products/components/ProductQuickForm";
import { createInventoryItem } from "@/lib/actions/inventory";
import { Loader2 } from "lucide-react";

interface ProductOption {
  id: string;
  code: string;
  name: string;
  inventoryTracking: "UNIT" | "QUANTITY";
}

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

interface InventoryItemFormProps {
  products: ProductOption[];
  categories: CategoryOption[];
}

export function InventoryItemForm({ products, categories }: InventoryItemFormProps) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [inventoryTracking, setInventoryTracking] = useState<"UNIT" | "QUANTITY">("UNIT");
  const [unitCount, setUnitCount] = useState(1);
  const [quantityOnHand, setQuantityOnHand] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  // Track locally-created products so they appear in the selector
  const [localProducts, setLocalProducts] = useState<ProductOption[]>([]);
  const allProducts = [...products, ...localProducts];

  const productColumns: EntitySelectorColumn<ProductOption>[] = [
    { key: "code", header: "Código", cell: (p) => p.code, className: "w-[100px]" },
    { key: "name", header: "Nombre", cell: (p) => p.name },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      toast.error("Seleccione un producto");
      return;
    }
    setLoading(true);
    const result = await createInventoryItem({
      productId,
      inventoryTracking,
      unitCount: inventoryTracking === "UNIT" ? unitCount : undefined,
      quantityOnHand: inventoryTracking === "QUANTITY" ? quantityOnHand : undefined,
      notes: notes || undefined,
    });
    setLoading(false);
    if (result.success) {
      const count = result.data.ids.length;
      toast.success(
        inventoryTracking === "UNIT"
          ? `${count} ${count === 1 ? "unidad agregada" : "unidades agregadas"} al inventario`
          : "Item agregado al inventario"
      );
      router.push("/inventario");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Producto *</Label>
            <EntitySelectorTrigger
              placeholder="Seleccionar producto..."
              displayValue={productName || undefined}
              onClick={() => setProductSelectorOpen(true)}
              onClear={() => {
                setProductId("");
                setProductName("");
                setInventoryTracking("UNIT");
              }}
            />
            <EntitySelectorModal
              open={productSelectorOpen}
              onOpenChange={setProductSelectorOpen}
              title="Seleccionar Producto"
              searchPlaceholder="Buscar por código o nombre..."
              size="lg"
              items={allProducts}
              columns={productColumns}
              searchFilter={(p, q) => {
                const lower = q.toLowerCase();
                return (
                  p.code.toLowerCase().includes(lower) ||
                  p.name.toLowerCase().includes(lower)
                );
              }}
              getItemId={(p) => p.id}
              selectedId={productId}
              onSelect={(p) => {
                setProductId(p.id);
                setProductName(`${p.code} - ${p.name}`);
                setInventoryTracking(p.inventoryTracking);
              }}
              allowCreate
              createLabel="Crear producto"
              renderCreateForm={({ onCreated, onCancel }) => (
                <ProductQuickForm
                  onCreated={(p) => {
                    setLocalProducts((prev) => [...prev, p]);
                    onCreated(p);
                  }}
                  onCancel={onCancel}
                  categories={categories}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {inventoryTracking === "UNIT" ? (
              <div className="space-y-2">
                <Label>Cantidad de unidades a crear</Label>
                <Input
                  type="number"
                  min={1}
                  value={unitCount}
                  onChange={(e) => setUnitCount(Number(e.target.value))}
                  className="text-base md:text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Se creará un item por unidad física con código auto-generado
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cantidad en stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={quantityOnHand}
                  onChange={(e) => setQuantityOnHand(Number(e.target.value))}
                  className="text-base md:text-sm"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales..."
              className="text-base md:text-sm"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/inventario")}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !productId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
