"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Phone, Mail, FileText } from "lucide-react";
import { getClient } from "@/lib/actions/clients";
import { formatDate } from "@/lib/utils";

interface ClientPreviewModalProps {
  clientId: string | null;
  onClose: () => void;
}

export function ClientPreviewModal({ clientId, onClose }: ClientPreviewModalProps) {
  const [client, setClient] = useState<Awaited<ReturnType<typeof getClient>> | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = !!clientId && loadedId !== clientId;

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    getClient(clientId).then((data) => {
      if (cancelled) return;
      setClient(data);
      setLoadedId(clientId);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <Dialog open={!!clientId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{loading ? "Cargando..." : client?.name ?? "Cliente"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : client ? (
          <div className="space-y-3 text-sm">
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {client.phone}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {client.email}
              </div>
            )}
            {client.notes && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {client.notes}
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Cliente desde</span>
              <span>{formatDate(client.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedidos</span>
              <span className="font-medium">{client.orders.length}</span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {clientId && (
            <Button asChild>
              <Link href={`/clientes/${clientId}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver detalle completo
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
