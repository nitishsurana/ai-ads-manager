import { Check, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  warning: {
    root: "border-warning-border bg-warning text-warning-foreground",
    icon: <TriangleAlert className="size-4" aria-hidden="true" />,
  },
  error: {
    root: "border-destructive-border bg-destructive-subtle text-destructive",
    icon: <CircleAlert className="size-4" aria-hidden="true" />,
  },
  info: {
    root: "border-border bg-muted text-foreground",
    icon: <Info className="size-4 text-muted-foreground" aria-hidden="true" />,
  },
  success: {
    root: "border-border bg-muted text-foreground",
    icon: (
      <Check
        className="size-4 text-success"
        strokeWidth={2.4}
        aria-hidden="true"
      />
    ),
  },
};

type AlertProps = {
  tone: keyof typeof tones;
  message: string;
};

export function Alert({ tone, message }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 font-sans",
        tones[tone].root,
      )}
    >
      <span className="flex shrink-0">{tones[tone].icon}</span>
      <p className="m-0 flex-1 text-[13.5px]">{message}</p>
    </div>
  );
}
