import type { ReactNode } from "react";
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
  detail?: string;
  // Sits at the right of a single-line alert; a stacked alert takes its action as children.
  action?: ReactNode;
  children?: ReactNode;
};

// With a detail or an action the alert stacks them under the message.
export function Alert({ tone, message, detail, action, children }: AlertProps) {
  const stacked = Boolean(detail || children);

  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex w-full gap-3 rounded-lg border font-sans",
        stacked ? "items-start p-4" : "items-center px-3 py-2.5",
        tones[tone].root,
      )}
    >
      <span className={cn("flex shrink-0", stacked && "mt-0.5")}>
        {tones[tone].icon}
      </span>
      {stacked ? (
        <div className="flex flex-1 flex-col gap-2.5">
          <p className="m-0 text-[15px] font-medium">{message}</p>
          {detail && (
            <p className="m-0 text-[13px] text-foreground">{detail}</p>
          )}
          {children && <div>{children}</div>}
        </div>
      ) : (
        <>
          <p className="m-0 flex-1 text-[13.5px]">{message}</p>
          {action}
        </>
      )}
    </div>
  );
}
