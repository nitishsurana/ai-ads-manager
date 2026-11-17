"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Research } from "@/lib/chat/types";

export function ResearchNote({ topic, notes, sources }: Research) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-1.5 font-sans text-foreground">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex h-6.5 max-w-full items-center gap-1.5 self-start rounded-full border border-border bg-muted px-2 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Globe className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Researched {topic}</span>
        <span className="shrink-0">
          · {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
        <ChevronDown
          className={cn("size-3 shrink-0", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 border-l-2 border-border py-0.5 pl-2.5 text-[12.5px]">
          {notes.map((note, index) => (
            <span key={index}>{note}</span>
          ))}
          <span className="text-muted-foreground">
            {sources.map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-2 text-primary-text hover:underline"
              >
                {source.label}
              </a>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
