import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type FieldProps = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
};

export function Field({ id, label, hint, ...props }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <Input id={id} {...props} />
      {hint && (
        <p className="m-0 mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
