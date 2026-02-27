"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import {
  EntitySelectorModal,
  type EntitySelectorColumn,
} from "@/components/shared/EntitySelectorModal";
import { CategoryQuickForm } from "@/features/products/components/CategoryQuickForm";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { createProduct, getSuggestedProductCode } from "@/lib/actions/products";
import { PRODUCT_TYPE_LABELS, INVENTORY_TRACKING_LABELS } from "@/lib/constants/categories";

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
  inventoryTracking: "UNIT" | "QUANTITY";
}

interface ProductQuickFormProps {
  onCreated: (product: ProductOption) => void;
  onCancel: () => void;
  categories: CategoryOption[];
}

export function ProductQuickForm({
  onCreated,
  onCancel,
  categories: initialCategories,
}: ProductQuickFormProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("RENTAL");
  const [inventoryTracking, setInventoryTracking] = useState<"UNIT" | "QUANTITY">("UNIT");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [rentalPrice, setRentalPrice] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);
  const [localCategories, setLocalCategories] = useState<CategoryOption[]>([]);

  const allCategories = [...initialCategories, ...localCategories];

  // Auto-code suggestion (same logic as ProductForm)
  const hasManualCodeEdit = useRef(false);
  const isApplyingSuggestion = useRef(false);
  const suggestionRequestId = useRef(0);

  useEffect(() => {
    if (!categoryId) return;
    if (hasManualCodeEdit.current && code) return;

    const currentRequestId = ++suggestionRequestId.current;
    void (async () => {
      const result = await getSuggestedProductCode(categoryId);
      if (!result.success) return;
      if (currentRequestId !== suggestionRequestId.current) return;

      isApplyingSuggestion.current = true;
      setCode(result.data.code);
      isApplyingSuggestion.current = false;
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const categoryColumns: EntitySelectorColumn<CategoryOption>[] = [
    { key: "name", header: "Nombre", cell: (c) => c.name },
    { key: "code", header: "Código", cell: (c) => c.code, className: "w-[100px]" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!code.trim() || !name.trim() || !type) return;
    setLoading(true);
    const result = await createProduct({
      code: code.trim(),
      name: name.trim(),
      type: type as "RENTAL" | "SALE" | "BOTH",
      inventoryTracking,
      categoryId: categoryId || null,
      salePrice,
      rentalPrice,
      cost,
      description,
    });
    setLoading(false);
    if (result.success) {
      toast.success("Producto creado");
      onCreated({ id: result.data.id, code: code.trim(), name: name.trim(), inventoryTracking });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pq-code">Código *</Label>
          <Input
            id="pq-code"
            value={code}
            onChange={(e) => {
              if (!isApplyingSuggestion.current) {
                hasManualCodeEdit.current = true;
              }
              setCode(e.target.value);
            }}
            placeholder="VG-001"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pq-name">Nombre *</Label>
          <Input
            id="pq-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del producto"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo *</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="text-base md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Seguimiento *</Label>
          <Select value={inventoryTracking} onValueChange={(v) => setInventoryTracking(v as "UNIT" | "QUANTITY")}>
            <SelectTrigger className="text-base md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INVENTORY_TRACKING_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoría</Label>
          <EntitySelectorTrigger
            placeholder="Sin categoría"
            displayValue={allCategories.find((c) => c.id === categoryId)?.name}
            onClick={() => setCategorySelectorOpen(true)}
            onClear={() => setCategoryId(null)}
          />
          <EntitySelectorModal
            open={categorySelectorOpen}
            onOpenChange={setCategorySelectorOpen}
            title="Seleccionar Categoría"
            searchPlaceholder="Buscar categoría..."
            items={allCategories}
            columns={categoryColumns}
            searchFilter={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
            getItemId={(c) => c.id}
            selectedId={categoryId ?? undefined}
            onSelect={(c) => setCategoryId(c.id)}
            allowCreate
            createLabel="Crear categoría"
            renderCreateForm={({ onCreated: onCatCreated, onCancel: onCatCancel }) => (
              <CategoryQuickForm
                onCreated={(cat) => {
                  setLocalCategories((prev) => [...prev, cat]);
                  setCategoryId(cat.id);
                  onCatCreated(cat);
                }}
                onCancel={onCatCancel}
              />
            )}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pq-sale-price">Precio Venta</Label>
          <MoneyInput
            value={salePrice}
            placeholder="$0"
            onValueChange={setSalePrice}
            className="text-base md:text-sm"
            name="pq-sale-price"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pq-rental-price">Precio Alquiler</Label>
          <MoneyInput
            value={rentalPrice}
            placeholder="$0"
            onValueChange={setRentalPrice}
            className="text-base md:text-sm"
            name="pq-rental-price"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pq-cost">Costo</Label>
          <MoneyInput
            value={cost}
            placeholder="$0"
            onValueChange={setCost}
            className="text-base md:text-sm"
            name="pq-cost"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pq-description">Descripción</Label>
        <Textarea
          id="pq-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción del producto..."
          rows={3}
          className="text-base md:text-sm"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Volver
        </Button>
        <Button type="submit" disabled={loading || !code.trim() || !name.trim()}>
          {loading ? "Creando..." : "Crear y Seleccionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
