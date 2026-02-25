"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LocalSearchInput } from "@/components/shared/LocalSearchInput";

export interface EntitySelectorColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface EntitySelectorModalProps<T> {
  // Control
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Entity config
  title: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  size?: "default" | "lg"; // "default" = sm:max-w-lg, "lg" = sm:max-w-2xl

  // Data
  items: T[];
  columns: EntitySelectorColumn<T>[];
  searchFilter: (item: T, query: string) => boolean;
  getItemId: (item: T) => string;

  // Selection
  selectedId?: string;
  onSelect: (item: T) => void;

  // Create (optional)
  allowCreate?: boolean;
  createLabel?: string;
  renderCreateForm?: (props: {
    onCreated: (item: T) => void;
    onCancel: () => void;
  }) => ReactNode;
}

export function EntitySelectorModal<T>({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  emptyMessage,
  size = "default",
  items,
  columns,
  searchFilter,
  getItemId,
  selectedId,
  onSelect,
  allowCreate,
  createLabel = "Crear nuevo",
  renderCreateForm,
}: EntitySelectorModalProps<T>) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "create">("list");

  // Reset state every time the modal opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setView("list");
    }
  }, [open]);

  const filteredItems =
    search === "" ? items : items.filter((item) => searchFilter(item, search));

  const tableColumns: Column<T>[] = columns.map((col) => ({
    key: col.key,
    header: col.header,
    cell: col.cell,
    className: col.className,
  }));

  const handleSelect = (item: T) => {
    onSelect(item);
    onOpenChange(false);
  };

  const handleCreated = (item: T) => {
    onSelect(item);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={size === "lg" ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {view === "create" && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setView("list")}
                className="h-7 w-7 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {view === "create" ? createLabel : title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {view === "list" && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <LocalSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={searchPlaceholder ?? "Buscar..."}
                />
              </div>
              {allowCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setView("create")}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {createLabel}
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-[50vh]">
              <div className="overflow-x-auto">
                <DataTable
                  columns={tableColumns}
                  data={filteredItems}
                  onRowClick={handleSelect}
                  emptyMessage={emptyMessage ?? "No se encontraron resultados"}
                />
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </DialogFooter>
          </>
        )}

        {view === "create" &&
          renderCreateForm?.({
            onCreated: handleCreated,
            onCancel: () => setView("list"),
          })}
      </DialogContent>
    </Dialog>
  );
}
