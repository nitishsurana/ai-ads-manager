"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

type SwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 font-sans text-[13px] text-foreground",
        className,
      )}
    >
      <span aria-hidden="true">{label}</span>
      <SwitchPrimitive.Root
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 shrink-0 rounded-full border-0 bg-border p-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 data-[state=checked]:bg-primary"
      >
        <SwitchPrimitive.Thumb className="absolute top-[3px] left-[3px] size-4.5 rounded-full bg-white shadow-sm transition-all data-[state=checked]:left-[19px]" />
      </SwitchPrimitive.Root>
    </div>
  );
}
