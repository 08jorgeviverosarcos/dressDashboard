import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "neutral" | "positive" | "negative" | "warning";

const toneClasses: Record<StatTone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: StatTone;
  footer?: React.ReactNode;
  href?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
  footer,
  href,
}: StatCardProps) {
  const body = (
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", toneClasses[tone])}>{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {footer && <div className="mt-2 text-xs text-muted-foreground">{footer}</div>}
    </CardContent>
  );

  if (href) {
    return (
      <Card className="transition-colors hover:border-primary/50">
        <Link href={href} className="block">
          {body}
        </Link>
      </Card>
    );
  }

  return <Card>{body}</Card>;
}
