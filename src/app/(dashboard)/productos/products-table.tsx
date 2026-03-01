"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants/categories";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  code: string;
  name: string;
  type: string;
  category: { id: string; name: string } | null;
  salePrice: number | string | null;
  rentalPrice: number | string | null;
}

interface ProductsTableProps {
  products: Product[];
  currentType?: string;
}

export function ProductsTable({ products, currentType }: ProductsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns: Column<Product>[] = [
    {
      key: "code",
      header: "Código",
      cell: (row) => (
        <span className="font-medium">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: "Nombre",
      cell: (row) => row.name,
    },
    {
      key: "type",
      header: "Tipo",
      cell: (row) => PRODUCT_TYPE_LABELS[row.type] ?? row.type,
    },
    {
      key: "category",
      header: "Categoría",
      cell: (row) => row.category?.name ?? "-",
    },
    {
      key: "salePrice",
      header: "Precio Venta",
      cell: (row) =>
        row.salePrice != null ? formatCurrency(row.salePrice) : "-",
      className: "text-right",
    },
    {
      key: "rentalPrice",
      header: "Precio Alquiler",
      cell: (row) =>
        row.rentalPrice != null ? formatCurrency(row.rentalPrice) : "-",
      className: "text-right",
    },
  ];

  function handleTypeChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchInput placeholder="Buscar por código o nombre..." />
        </div>
        <Select
          value={currentType ?? "ALL"}
          onValueChange={handleTypeChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={products}
        onRowClick={(row) => router.push(`/productos/${row.id}`)}
        emptyMessage="No se encontraron productos"
      />
    </div>
  );
}
