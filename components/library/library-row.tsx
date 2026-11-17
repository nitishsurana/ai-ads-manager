import { angleLabel } from "@/components/rounds/stages";
import type { LibraryCreative } from "@/lib/round";
import { cn } from "@/lib/utils";
import { DownloadPngButton } from "./downloads";

const BADGE = {
  approve: [
    "Approved",
    "border border-success-border bg-success-subtle text-success",
  ],
  reject: [
    "Rejected",
    "border border-destructive-border bg-destructive-subtle text-destructive",
  ],
  none: ["Not rated yet", "bg-muted text-muted-foreground"],
} as const;

const PILL =
  "inline-flex h-5.5 items-center rounded-full px-2 text-xs font-medium";

export function LibraryRow({
  creative,
  last,
}: {
  creative: LibraryCreative;
  last: boolean;
}) {
  const [ratingLabel, ratingClass] = BADGE[creative.rating ?? "none"];
  const { netEdit } = creative;
  return (
    <article
      aria-label={`Creative ${creative.n}`}
      className={cn(
        "grid w-full grid-cols-[108px_minmax(0,1fr)_auto] items-start gap-5 bg-card px-4 py-3.5",
        !last && "border-b border-border",
      )}
    >
      <div className="aspect-[9/16] overflow-hidden rounded-lg border border-border bg-stage">
        {creative.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL
          <img
            src={creative.previewUrl}
            alt={`Creative ${creative.n}: ${creative.headline}. Button: ${creative.cta}`}
            className="block h-full w-full"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Creative {creative.n}</span>
          <span className={cn(PILL, "bg-muted text-muted-foreground")}>
            {angleLabel(creative.angle)}
          </span>
          <span className={cn(PILL, ratingClass)}>{ratingLabel}</span>
          {netEdit && (
            <span className={cn(PILL, "bg-primary-subtle text-primary-text")}>
              Edited · {creative.editCount}
            </span>
          )}
        </div>
        <p className="m-0 text-[13px] text-muted-foreground">
          “{creative.headline}” · CTA “{creative.cta}”
        </p>
        <dl className="m-0 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">
            {creative.rating === "reject" ? "Reason" : "Note"}
          </dt>
          <dd className="m-0">{creative.note || "—"}</dd>
          <dt className="text-muted-foreground">Tags</dt>
          <dd className="m-0 flex flex-wrap gap-1">
            {creative.tags.map((tag) => (
              <span
                key={tag}
                className={cn(PILL, "border border-border bg-card")}
              >
                {tag}
              </span>
            ))}
            {creative.tags.length === 0 && (
              <span className="text-muted-foreground">None</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Edits</dt>
          <dd className="m-0 flex flex-col gap-0.5">
            {netEdit ? (
              <>
                {netEdit.from.headline !== netEdit.to.headline && (
                  <EditLine
                    field="Headline"
                    from={netEdit.from.headline}
                    to={netEdit.to.headline}
                  />
                )}
                {netEdit.from.cta !== netEdit.to.cta && (
                  <EditLine
                    field="CTA"
                    from={netEdit.from.cta}
                    to={netEdit.to.cta}
                  />
                )}
              </>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </dd>
        </dl>
      </div>
      <DownloadPngButton creativeId={creative.id} />
    </article>
  );
}

function EditLine({
  field,
  from,
  to,
}: {
  field: string;
  from: string;
  to: string;
}) {
  return (
    <span>
      <span className="text-muted-foreground">{field}:</span>{" "}
      <span className="text-muted-foreground line-through">{from}</span> → {to}
    </span>
  );
}
