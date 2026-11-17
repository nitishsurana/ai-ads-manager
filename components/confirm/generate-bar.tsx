"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GenerateBarProps = {
  summary: string;
  note: string;
  tone: "muted" | "warning" | "error";
  disabled: boolean;
  pending: boolean;
  label: string;
  pendingLabel: string;
  onSubmit: () => void;
};

export function GenerateBar({
  summary,
  note,
  tone,
  disabled,
  pending,
  label,
  pendingLabel,
  onSubmit,
}: GenerateBarProps) {
  return (
    <div className="w-full border-t border-border bg-card px-8 py-3.5 font-sans text-sm text-foreground shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div className="flex max-w-[960px] items-center gap-4">
        <div className="flex flex-1 flex-col gap-0.5" aria-live="polite">
          <span className="text-[13.5px] font-medium">{summary}</span>
          <span
            className={cn(
              "text-xs",
              tone === "error" && "text-destructive",
              tone === "warning" && "text-warning-foreground",
              tone === "muted" && "text-muted-foreground",
            )}
          >
            {note}
          </span>
        </div>
        <Button size="lg" disabled={disabled || pending} onClick={onSubmit}>
          {pending ? pendingLabel : label}
          {!pending && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
