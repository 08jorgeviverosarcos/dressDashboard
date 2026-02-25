"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/actions/clients";

interface ClientOption {
  id: string;
  name: string;
}

interface ClientQuickFormProps {
  onCreated: (client: ClientOption) => void;
  onCancel: () => void;
}

export function ClientQuickForm({ onCreated, onCancel }: ClientQuickFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const result = await createClient({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    setLoading(false);
    if (result.success) {
      toast.success("Cliente creado");
      onCreated({ id: result.data.id, name: name.trim() });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cl-name">Nombre *</Label>
          <Input
            id="cl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del cliente"
            required
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cl-phone">Teléfono</Label>
          <Input
            id="cl-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="555-0000"
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cl-email">Email</Label>
          <Input
            id="cl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            className="text-base md:text-sm"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Volver
        </Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creando..." : "Crear y Seleccionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
