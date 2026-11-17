import type { AdminSummary } from "@/lib/admin";
import { money } from "./format";
import { StatTile } from "./stat-tile";

export function SummaryTiles({
  summary,
  unattributed,
}: {
  summary: AdminSummary;
  unattributed: number;
}) {
  const perRound =
    summary.costPerRound === null ? "—" : money(summary.costPerRound);

  return (
    <section aria-label="Summary" className="flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-3">
        <StatTile
          label="Rounds"
          value={String(summary.rounds)}
          sub={`${summary.creatives} creatives`}
        />
        <StatTile
          label="Approved"
          value={
            summary.approvalRate === null
              ? "—"
              : `${Math.round(summary.approvalRate * 100)}%`
          }
          sub={`${summary.approved} of ${summary.rated} rated creatives`}
        />
        <StatTile
          label="Mean judge score"
          value={
            summary.meanJudge === null ? "—" : summary.meanJudge.toFixed(1)
          }
          unit="/ 5"
          sub="Across all creatives"
        />
        <StatTile
          label="Text edits"
          value={String(summary.edits)}
          sub="Headline and CTA"
        />
        <StatTile
          label="Cost"
          value={money(summary.cost)}
          sub={`${perRound} per round · rounds and their workspaces`}
        />
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Unattributed {money(unattributed)} (all time): cost rows with no
        workspace, such as failed reads and chat before a workspace existed.
      </p>
    </section>
  );
}
