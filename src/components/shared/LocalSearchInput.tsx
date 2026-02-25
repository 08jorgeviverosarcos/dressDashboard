"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface LocalSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function LocalSearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
}: LocalSearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 text-base md:text-sm"
      />
    </div>
  );
}
