import type { AdminCreative } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { angleLabel } from "./format";
import { JudgeScores } from "./judge-scores";

const PILL =
  "inline-flex h-5.5 items-center rounded-full px-2 text-xs font-medium";

function HumanRating({ creative }: { creative: AdminCreative }) {
  const { rating } = creative;
  return (
    <span
      className={cn(
        PILL,
        rating === "approve" &&
          "border border-success-border bg-success-subtle text-success",
        rating === "reject" &&
          "border border-destructive-border bg-destructive-subtle text-destructive",
        rating === null && "bg-muted text-muted-foreground",
      )}
    >
      {rating === "approve"
        ? "Approved"
        : rating === "reject"
          ? "Rejected"
          : "Not rated"}
    </span>
  );
}

export function DetailCard({
  creative,
  tester,
}: {
  creative: AdminCreative;
  tester: string;
}) {
  const { judge } = creative;
  const reason = [
    creative.tags.join(", "),
    creative.note ? `“${creative.note}”` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      aria-label={`Creative ${creative.n}`}
      className="flex gap-3 rounded-[10px] border border-border bg-card p-3 text-[13px]"
    >
      <div className="w-21 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {creative.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.previewUrl}
            alt={`Creative ${creative.n}, ${angleLabel(creative.angle)}`}
            className="aspect-[9/16] w-full object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            #{creative.n} {angleLabel(creative.angle)} · Human · {tester}
          </span>
          <span>
            <HumanRating creative={creative} />
          </span>
          {reason && <span>{reason}</span>}
          {creative.edits > 0 && (
            <span className="text-muted-foreground">
              {creative.edits} text {creative.edits === 1 ? "edit" : "edits"}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          <span className="text-xs font-medium text-muted-foreground">
            Vision judge
          </span>
          {judge ? (
            <>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">
                  {judge.mean.toFixed(1)} / 5
                </span>
                <span
                  className={cn(
                    PILL,
                    judge.pass
                      ? "bg-success-subtle text-success"
                      : "bg-destructive-subtle text-destructive",
                  )}
                >
                  {judge.pass ? "Pass" : "Fail"}
                </span>
                {judge.lowConfidence && (
                  <span
                    className={cn(PILL, "bg-warning text-warning-foreground")}
                  >
                    Low confidence
                  </span>
                )}
              </span>
              <JudgeScores judge={judge} />
            </>
          ) : (
            <span className="text-muted-foreground">Not judged</span>
          )}
        </div>
      </div>
    </article>
  );
}
