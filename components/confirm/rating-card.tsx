"use client";

import { Switch } from "@/components/ui/switch";
import type { ConfirmState } from "@/lib/confirm";

type RatingCardProps = {
  rating: ConfirmState["rating"];
  show: boolean;
  onShow: (show: boolean) => void;
};

export function RatingCard({ rating, show, onShow }: RatingCardProps) {
  return (
    <section
      aria-labelledby="rating-h"
      className="flex w-full flex-col gap-3.5 rounded-xl border border-border bg-card p-5 font-sans text-sm text-foreground shadow-xs"
    >
      <div className="flex items-center gap-2.5">
        <h2
          id="rating-h"
          className="m-0 text-base font-semibold tracking-tight"
        >
          Rating
        </h2>
        {rating && (
          <Switch
            className="ml-auto"
            label="Show rating"
            checked={show}
            onCheckedChange={onShow}
          />
        )}
      </div>
      {rating ? (
        <>
          <div className="flex items-center gap-3">
            <span className="text-[32px] font-semibold tracking-tight">
              {rating.value.toFixed(1)}
            </span>
            <span className="flex flex-col">
              <span
                aria-hidden="true"
                className="tracking-[2px] text-[#C98A06]"
              >
                ★★★★★
              </span>
              <span className="text-[13px]">
                {rating.value.toFixed(1)} stars,{" "}
                {rating.count.toLocaleString("en-US")} reviews
              </span>
            </span>
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            On by default at 4.0+ stars and 20+ reviews.{" "}
            {show ? "" : "Rating won’t appear in ads."}
          </p>
        </>
      ) : (
        <p className="m-0 text-muted-foreground">No rating found.</p>
      )}
    </section>
  );
}
