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
import { Loader2, ExternalLink } from "lucide-react";
import { getCategory } from "@/lib/actions/categories";

interface CategoryPreviewModalProps {
  categoryId: string | null;
  onClose: () => void;
}

export function CategoryPreviewModal({ categoryId, onClose }: CategoryPreviewModalProps) {
  const [category, setCategory] = useState<Awaited<ReturnType<typeof getCategory>> | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = !!categoryId && loadedId !== categoryId;

  useEffect(() => {
    if (!categoryId) return;

    let cancelled = false;
    getCategory(categoryId).then((data) => {
      if (cancelled) return;
      setCategory(data);
      setLoadedId(categoryId);
    });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  return (
    <Dialog open={!!categoryId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{loading ? "Cargando..." : category?.name ?? "Categoría"}</DialogTitle>
          {category?.code && (
            <p className="text-sm text-muted-foreground">{category.code}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : category ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código</span>
              <span className="font-medium">{category.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Productos activos</span>
              <span className="font-medium">{category.products.length}</span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {categoryId && (
            <Button asChild>
              <Link href={`/categorias/${categoryId}`}>
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
