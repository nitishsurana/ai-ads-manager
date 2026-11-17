import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "block w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-primary-subtle disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
