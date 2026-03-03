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
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";
import { getProduct } from "@/lib/actions/products";
import { formatCurrency } from "@/lib/utils";
import {
  PRODUCT_TYPE_LABELS,
  INVENTORY_TRACKING_LABELS,
} from "@/lib/constants/categories";

interface ProductPreviewModalProps {
  productId: string | null;
  onClose: () => void;
}

export function ProductPreviewModal({ productId, onClose }: ProductPreviewModalProps) {
  const [product, setProduct] = useState<Awaited<ReturnType<typeof getProduct>> | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = !!productId && loadedId !== productId;

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;
    getProduct(productId).then((data) => {
      if (cancelled) return;
      setProduct(data);
      setLoadedId(productId);
    });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <Dialog open={!!productId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{loading ? "Cargando..." : product?.name ?? "Producto"}</DialogTitle>
          {product?.code && (
            <p className="text-sm text-muted-foreground">{product.code}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : product ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <Badge variant="secondary">{PRODUCT_TYPE_LABELS[product.type]}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inventario</span>
              <span>{INVENTORY_TRACKING_LABELS[product.inventoryTracking]}</span>
            </div>
            {product.category && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoría</span>
                <span>{product.category.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio Venta</span>
              <span className="font-medium">
                {product.salePrice ? formatCurrency(product.salePrice) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio Alquiler</span>
              <span className="font-medium">
                {product.rentalPrice ? formatCurrency(product.rentalPrice) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo</span>
              <span className="font-medium">
                {product.cost ? formatCurrency(product.cost) : "—"}
              </span>
            </div>
            {product.description && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Descripción</span>
                <p className="mt-1">{product.description}</p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {productId && (
            <Button asChild>
              <Link href={`/productos/${productId}`}>
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
