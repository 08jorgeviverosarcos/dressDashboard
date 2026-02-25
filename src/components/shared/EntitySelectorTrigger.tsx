"use client";

import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntitySelectorTriggerProps {
  placeholder?: string;
  displayValue?: string;
  onClick: () => void;
  onClear?: () => void;
  disabled?: boolean;
}

export function EntitySelectorTrigger({
  placeholder = "Seleccionar...",
  displayValue,
  onClick,
  onClear,
  disabled,
}: EntitySelectorTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <span className={cn("truncate", displayValue ? "text-foreground" : "text-muted-foreground")}>
        {displayValue ?? placeholder}
      </span>
      <div className="flex shrink-0 items-center gap-1 ml-2">
        {onClear && displayValue && (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          />
        )}
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </div>
    </button>
  );
}
