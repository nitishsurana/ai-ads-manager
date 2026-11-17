"use client";

import { Badge } from "@/components/ui/badge";
import { messages } from "@/lib/messages";
import type { ConfirmPhoto } from "@/lib/confirm";
import { cn } from "@/lib/utils";

const FLAG_BADGE = {
  low_resolution: "Low resolution",
  photo_text: "Added text",
} as const;

type PhotoTileProps = {
  photo: ConfirmPhoto;
  url: string | null;
  background: "plain" | "scene";
  onToggle: (selected: boolean) => void;
};

export function PhotoTile({
  photo,
  url,
  background,
  onToggle,
}: PhotoTileProps) {
  const labels = [
    background === "plain" ? "Plain background" : "Scene",
    ...photo.warnings.map((code) => FLAG_BADGE[code]),
  ];

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[10px] border-2 bg-card font-sans",
        photo.selected ? "border-primary" : "border-border",
      )}
    >
      <label className="relative block cursor-pointer">
        <div
          className={cn(
            "aspect-square bg-muted",
            photo.selected ? "opacity-100" : "opacity-45",
          )}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`Product photo ${photo.position}`}
              className="size-full object-cover"
            />
          )}
        </div>
        <input
          type="checkbox"
          checked={photo.selected}
          onChange={(event) => onToggle(event.currentTarget.checked)}
          aria-label={`Use photo ${photo.position} (${labels.join(", ")})`}
          className="absolute top-2 right-2 m-0 size-4.5 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <span className="absolute inset-x-1.5 bottom-1.5 flex flex-wrap gap-1">
          {labels.map((label) => {
            const flagged =
              label === FLAG_BADGE.photo_text ||
              label === FLAG_BADGE.low_resolution;
            return (
              <Badge
                key={label}
                variant={flagged ? "warning" : "outline"}
                className={cn(
                  "h-5 px-1.5 text-[11px]",
                  !flagged && "text-muted-foreground",
                )}
              >
                {label}
              </Badge>
            );
          })}
        </span>
      </label>
      {photo.warnings.map((code) => (
        <p
          key={code}
          className="m-0 border-t border-warning-border bg-warning px-2 py-1.5 text-[11.5px] leading-snug text-warning-foreground"
        >
          {messages[code]}
        </p>
      ))}
    </div>
  );
}
