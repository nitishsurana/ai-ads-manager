import Link from "next/link";
import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS = ["Confirm", "Generate", "Rate and repeat"];

type StepperProps = {
  step: 1 | 2 | 3;
  // Once the first round exists, step 1 opens the confirm screen in edit mode.
  confirmHref?: string;
};

export function Stepper({ step, confirmHref }: StepperProps) {
  return (
    <ol
      aria-label="Steps"
      className="m-0 flex list-none items-center gap-2.5 p-0 font-sans text-[13px] text-foreground"
    >
      {LABELS.map((label, index) => {
        const n = index + 1;
        const done = n < step;
        const current = n === step;
        const content = (
          <>
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-[11px]",
                done && "bg-muted",
                current && "bg-primary text-primary-foreground",
                !done && !current && "border border-border",
              )}
            >
              {done ? (
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              ) : (
                n
              )}
            </span>
            {label}
          </>
        );
        return (
          <Fragment key={label}>
            {index > 0 && (
              <li aria-hidden="true" className="h-px w-6 bg-border" />
            )}
            <li
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5",
                current ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {n === 1 && confirmHref ? (
                <Link
                  href={confirmHref}
                  className="flex items-center gap-1.5 text-primary-text no-underline hover:underline"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
