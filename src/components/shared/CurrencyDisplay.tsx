import { formatCurrency } from "@/lib/utils";

interface CurrencyDisplayProps {
  value: number | string | null | undefined;
  className?: string;
}

export function CurrencyDisplay({ value, className }: CurrencyDisplayProps) {
  return <span className={className}>{formatCurrency(value)}</span>;
}
