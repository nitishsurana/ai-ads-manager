import { cn } from "@/lib/utils";

type CreativeSkeletonProps = { n: number; angle: string; animated: boolean };

export function CreativeSkeleton({
  n,
  angle,
  animated,
}: CreativeSkeletonProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card font-sans text-sm text-foreground shadow-xs">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-[13px] font-semibold text-muted-foreground">
          Creative {n}
        </span>
        {angle && (
          <span className="inline-flex h-5.5 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
            {angle}
          </span>
        )}
      </div>
      <div
        className={cn(
          "aspect-[9/16] border-t border-border",
          animated
            ? "animate-shimmer bg-[linear-gradient(90deg,var(--color-muted)_0%,var(--color-border)_50%,var(--color-muted)_100%)] bg-[length:200%_100%]"
            : "bg-muted opacity-60",
        )}
      />
    </div>
  );
}
