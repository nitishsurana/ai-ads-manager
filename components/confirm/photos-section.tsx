"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Answers, ConfirmState } from "@/lib/confirm";
import { PhotoTile } from "./photo-tile";

type PhotoView = {
  position: number;
  url: string | null;
  background: "plain" | "scene";
  uncuttable: boolean;
};

type PhotosSectionProps = {
  state: ConfirmState;
  views: PhotoView[];
  apply: (answers: Answers) => void;
};

export function PhotosSection({ state, views, apply }: PhotosSectionProps) {
  const selected = state.photos.filter((photo) => photo.selected).length;
  const byPosition = new Map(views.map((view) => [view.position, view]));

  return (
    <section
      id="photos"
      aria-labelledby="photos-h"
      className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2.5">
        <h2
          id="photos-h"
          className="m-0 text-base font-semibold tracking-tight"
        >
          Photos
        </h2>
        <Badge>
          {selected} of {state.photos.length} selected
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() =>
            apply({ select: state.photos.map((photo) => photo.position) })
          }
        >
          Select all
        </Button>
      </div>
      <p className="-mt-2 mb-0 text-xs text-muted-foreground">
        Every usable photo is selected. Untick any you don’t want in ads. Photos
        we couldn’t use aren’t shown.
      </p>
      <div className="grid grid-cols-6 items-start gap-3">
        {state.photos.map((photo) => (
          <PhotoTile
            key={photo.position}
            photo={photo}
            url={byPosition.get(photo.position)?.url ?? null}
            background={byPosition.get(photo.position)?.background ?? "scene"}
            uncuttable={byPosition.get(photo.position)?.uncuttable ?? false}
            onToggle={(on) =>
              apply(
                on
                  ? { select: [photo.position] }
                  : { deselect: [photo.position] },
              )
            }
          />
        ))}
      </div>
    </section>
  );
}
