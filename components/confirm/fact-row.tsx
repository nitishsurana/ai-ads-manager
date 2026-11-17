"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Fact } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

type FactRowProps = {
  fact: Pick<Fact, "text" | "status">;
  onConfirm: () => void;
  onRemove: () => void;
  onSave: (text: string) => void;
};

export function FactRow({ fact, onConfirm, onRemove, onSave }: FactRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const pending = fact.status === "pending";
  const row = useRef<HTMLDivElement>(null);
  // Focus goes back to the row when the edit field closes.
  const close = () => {
    setDraft(null);
    requestAnimationFrame(() => row.current?.focus());
  };

  return (
    <div
      ref={row}
      tabIndex={-1}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[10px] border py-2 pr-2 pl-3 font-sans text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pending ? "border-warning-border bg-warning" : "border-border bg-card",
      )}
    >
      {draft === null ? (
        <>
          <span className="flex-1">{fact.text}</span>
          <Badge
            variant={pending ? "warning" : "success"}
            className={pending ? "bg-card" : undefined}
          >
            {pending ? "Needs your OK" : "Confirmed"}
          </Badge>
          {pending && (
            <Button
              size="sm"
              aria-label={`Confirm fact: ${fact.text}`}
              onClick={onConfirm}
            >
              Confirm
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-black/5"
            aria-label={`Edit fact: ${fact.text}`}
            onClick={() => setDraft(fact.text)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-black/5"
            aria-label={`Remove fact: ${fact.text}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </>
      ) : (
        <>
          <Input
            aria-label="Edit fact"
            className="h-8 flex-1"
            value={draft}
            maxLength={200}
            autoFocus
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && draft.trim()) {
                onSave(draft.trim());
                close();
              }
              if (event.key === "Escape") close();
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              if (!draft.trim()) return;
              onSave(draft.trim());
              close();
            }}
          >
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
