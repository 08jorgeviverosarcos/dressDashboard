"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateQuery(key: string, value: string, clearKeys: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    for (const clearKey of clearKeys) {
      params.delete(clearKey);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    params.delete("startDate");
    params.delete("endDate");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Mes</Label>
          <Input
            type="month"
            className="w-44"
            defaultValue={searchParams.get("month") ?? ""}
            onChange={(e) => updateQuery("month", e.target.value, ["startDate", "endDate"])}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            className="w-40"
            defaultValue={searchParams.get("startDate") ?? ""}
            onChange={(e) => updateQuery("startDate", e.target.value, ["month"])}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            className="w-40"
            defaultValue={searchParams.get("endDate") ?? ""}
            onChange={(e) => updateQuery("endDate", e.target.value, ["month"])}
          />
        </div>
        <Button variant="outline" onClick={clearFilters}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
