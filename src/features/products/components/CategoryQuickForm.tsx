"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { createCategory } from "@/lib/actions/categories";

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

interface CategoryQuickFormProps {
  onCreated: (category: CategoryOption) => void;
  onCancel: () => void;
}

export function CategoryQuickForm({ onCreated, onCancel }: CategoryQuickFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    const result = await createCategory({ name: name.trim(), code: code.trim() });
    setLoading(false);
    if (result.success) {
      toast.success("Categoría creada");
      onCreated({ id: result.data.id, name: name.trim(), code: code.trim() });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cat-name">Nombre *</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-code">Código *</Label>
          <Input
            id="cat-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: VES"
            required
            className="text-base md:text-sm"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Volver
        </Button>
        <Button type="submit" disabled={loading || !name.trim() || !code.trim()}>
          {loading ? "Creando..." : "Crear y Seleccionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
