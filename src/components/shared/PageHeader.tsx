import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function PageHeader({
  title,
  description,
  backHref,
  actionLabel,
  actionHref,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {backHref && (
          <Button variant="ghost" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actionLabel && actionHref && (
        <Button asChild>
          <Link href={actionHref}>
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Link>
        </Button>
      )}
    </div>
  );
}
