"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CommitInput } from "./commit-field";

type TextListProps = {
  title: string;
  items: string[];
  max: number;
  maxLength: number;
  itemLabel: string;
  addLabel: string;
  onChange: (items: string[]) => void;
};

// Each line saves when it loses focus; a line left empty is dropped.
export function TextList({
  title,
  items,
  max,
  maxLength,
  itemLabel,
  addLabel,
  onChange,
}: TextListProps) {
  const [adding, setAdding] = useState(false);
  const rows = adding ? [...items, ""] : items;

  const commit = (index: number, text: string) => {
    const next = rows
      .map((row, i) => (i === index ? text.trim() : row))
      .filter(Boolean);
    setAdding(false);
    if (next.join("\n") !== items.join("\n")) onChange(next);
  };

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium">{title}</span>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-1.5">
            <CommitInput
              aria-label={`${itemLabel} ${index + 1}`}
              value={row}
              maxLength={maxLength}
              autoFocus={adding && index === items.length}
              onCommit={(text) => commit(index, text)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
              onClick={() =>
                index < items.length
                  ? onChange(items.filter((_, i) => i !== index))
                  : setAdding(false)
              }
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      {items.length + (adding ? 1 : 0) < max && !adding && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1.5 gap-1.5 pr-3 pl-1"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
