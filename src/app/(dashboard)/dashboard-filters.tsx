"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DASHBOARD_STRINGS as S } from "@/features/dashboard/dashboard.strings";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMonthStart(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function utcMonthEnd(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

/** Rangos rápidos: siempre en UTC, igual que los cortes que usa el panel. */
function buildQuickRanges(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return [
    {
      key: "thisMonth",
      label: S.filters.thisMonth,
      start: utcMonthStart(year, month),
      end: utcMonthEnd(year, month),
    },
    {
      key: "lastMonth",
      label: S.filters.lastMonth,
      start: utcMonthStart(year, month - 1),
      end: utcMonthEnd(year, month - 1),
    },
    {
      key: "last3Months",
      label: S.filters.last3Months,
      start: utcMonthStart(year, month - 2),
      end: utcMonthEnd(year, month),
    },
    {
      key: "thisYear",
      label: S.filters.thisYear,
      start: utcMonthStart(year, 0),
      end: utcMonthEnd(year, 11),
    },
  ];
}

export function DashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const monthValue = searchParams.get("month") ?? "";
  const startValue = searchParams.get("startDate") ?? "";
  const endValue = searchParams.get("endDate") ?? "";
  const quickRanges = buildQuickRanges(new Date());

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

  function applyRange(start: Date, end: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    params.set("startDate", toIsoDate(start));
    params.set("endDate", toIsoDate(end));
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
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[9rem] flex-1 space-y-1 sm:flex-none sm:basis-44">
          <Label className="text-xs">{S.filters.month}</Label>
          <Input
            type="month"
            value={monthValue}
            onChange={(e) => updateQuery("month", e.target.value, ["startDate", "endDate"])}
          />
        </div>
        <div className="min-w-[9rem] flex-1 space-y-1 sm:flex-none sm:basis-40">
          <Label className="text-xs">{S.filters.from}</Label>
          <Input
            type="date"
            value={startValue}
            onChange={(e) => updateQuery("startDate", e.target.value, ["month"])}
          />
        </div>
        <div className="min-w-[9rem] flex-1 space-y-1 sm:flex-none sm:basis-40">
          <Label className="text-xs">{S.filters.to}</Label>
          <Input
            type="date"
            value={endValue}
            onChange={(e) => updateQuery("endDate", e.target.value, ["month"])}
          />
        </div>
        <Button variant="outline" onClick={clearFilters}>
          {S.filters.clear}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{S.filters.quickRanges}:</span>
        {quickRanges.map((range) => (
          <Button
            key={range.key}
            variant="secondary"
            size="sm"
            onClick={() => applyRange(range.start, range.end)}
          >
            {range.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
