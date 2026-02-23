"use client";

import { Input } from "@/components/ui/input";
import { NumericFormat } from "react-number-format";

interface MoneyInputProps {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  className?: string;
  name?: string;
}

export function MoneyInput({
  value,
  onValueChange,
  placeholder,
  disabled,
  min,
  className,
  name,
}: MoneyInputProps) {
  return (
    <NumericFormat
      customInput={Input}
      value={value ?? ""}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={0}
      allowNegative={false}
      prefix="$"
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      name={name}
      onValueChange={({ floatValue }) => {
        const nextValue = floatValue ?? null;
        if (typeof min === "number" && typeof nextValue === "number" && nextValue < min) {
          onValueChange(min);
          return;
        }
        onValueChange(nextValue);
      }}
    />
  );
}
