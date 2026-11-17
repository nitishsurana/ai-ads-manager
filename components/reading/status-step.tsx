import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepKind } from "@/lib/intake/reading/steps";

const SR_STATE: Record<StepKind, string> = {
  done: "Done",
  active: "In progress",
  failed: "Failed",
  pending: "Not started",
};

type StatusStepProps = {
  kind: StepKind;
  label: string;
  detail: string;
  last: boolean;
};

export function StatusStep({ kind, label, detail, last }: StatusStepProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 py-3.5 font-sans text-foreground",
        !last && "border-b border-border",
      )}
    >
      <span className="inline-flex size-6 shrink-0 items-center justify-center">
        {kind === "done" && (
          <span className="inline-flex size-5.5 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {kind === "active" && (
          <svg
            className="size-5 animate-spin text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
        )}
        {kind === "failed" && (
          <span className="inline-flex size-5.5 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
            <X className="size-3" strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {kind === "pending" && (
          <span className="size-4.5 rounded-full border-2 border-border" />
        )}
      </span>
      <span className="flex flex-1 flex-col">
        <span
          className={cn(
            "text-sm font-medium",
            kind === "failed" && "text-destructive",
            kind === "pending" && "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="sr-only">{SR_STATE[kind]}</span>
    </div>
  );
}
