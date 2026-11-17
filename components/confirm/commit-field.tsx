"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Commit = { value: string; onCommit: (value: string) => void };

// Edits save when the field loses focus. The key restarts the field when the saved value changes, so it always shows what was kept.
export function CommitInput({
  value,
  onCommit,
  ...props
}: Commit &
  Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onBlur">) {
  return (
    <Input
      key={value}
      defaultValue={value}
      onBlur={(event) => onCommit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      {...props}
    />
  );
}

export function CommitTextarea({
  value,
  onCommit,
  ...props
}: Commit &
  Omit<ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onBlur">) {
  return (
    <Textarea
      key={value}
      defaultValue={value}
      onBlur={(event) => onCommit(event.currentTarget.value)}
      {...props}
    />
  );
}
