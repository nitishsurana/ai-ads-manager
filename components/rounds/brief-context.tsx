import Link from "next/link";
import type { BriefPanelData } from "@/lib/brief/panel";
import { cn } from "@/lib/utils";

type BriefContextProps = {
  workspaceId: string;
  content: BriefPanelData["content"];
  facts: BriefPanelData["facts"];
};

// The campaign, the facts and the research notes the brief carries. Read-only here; the campaign is edited in step 1.
export function BriefContext({
  workspaceId,
  content,
  facts,
}: BriefContextProps) {
  const { campaign, research } = content;
  const notes = research.flatMap((item) => item.notes);
  const sources = research.flatMap((item) =>
    item.sources.filter((source) => source.href.startsWith("http")),
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[13px] font-semibold">Campaign context</h3>
        <Link
          href={`/w/${workspaceId}/confirm#facts`}
          className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-inherit no-underline hover:bg-muted"
        >
          Edit
        </Link>
      </div>
      <dl className="m-0 grid grid-cols-[96px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
        {(
          [
            ["Occasion", campaign.occasion],
            ["Angle", campaign.angle],
            ["Audience", campaign.audience],
          ] as const
        ).map(
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
              {fact.text}{" "}
              <span
                className={cn(
                  "ml-1 inline-flex h-5 items-center rounded-full border px-1.5 text-[11px] font-medium",
                  fact.status === "confirmed"
                    ? "border-success-border bg-success-subtle text-success"
                    : "border-warning-border bg-warning text-warning-foreground",
                )}
              >
                {fact.status === "confirmed" ? "Confirmed" : "Pending"}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          <span className="text-xs font-semibold text-muted-foreground">
            Research notes
          </span>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-4.5 text-[13px]">
            {notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
          {sources.length > 0 && (
            <p className="m-0 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              Sources:
              {sources.map((source) => (
                <a
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-text hover:underline"
                >
                  {source.label}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
