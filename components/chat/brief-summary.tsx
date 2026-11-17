import type { Fact } from "@/lib/db/queries";

type BriefSummaryProps = {
  occasion?: string;
  angle?: string;
  audience?: string;
  facts: Pick<Fact, "text" | "status">[];
};

export function BriefSummary({
  occasion,
  angle,
  audience,
  facts,
}: BriefSummaryProps) {
  const campaign = [
    ["Occasion", occasion],
    ["Angle", angle],
    ["Audience", audience],
  ] as const;

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5 font-sans text-foreground">
      <span className="text-xs font-semibold text-muted-foreground">
        Added to the creative brief
      </span>
      <dl className="m-0 grid grid-cols-[72px_1fr] gap-x-2 gap-y-0.5 text-[13px]">
        {campaign.map(
          ([label, value]) =>
            value && (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="m-0">{value}</dd>
              </div>
            ),
        )}
        {facts.map((fact, index) => (
          <div key={index} className="contents">
            <dt className="text-muted-foreground">Fact</dt>
            <dd className="m-0">
              {fact.text} ·{" "}
              {fact.status === "confirmed" ? (
                <span className="font-medium text-success">confirmed</span>
              ) : (
                <span className="font-medium text-warning-foreground">
                  confirm it on the right
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
