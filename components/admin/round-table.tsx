import type { TesterGroup } from "@/lib/admin";
import { COLUMNS, money } from "./format";
import { RoundRow } from "./round-row";

const HEADINGS = [
  "Workspace",
  "Round",
  "Creatives",
  "Human",
  "Judge (1–5)",
  "Reasons and tags",
  "Edits",
  "Cost",
];

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function RoundTable({ groups }: { groups: TesterGroup[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full min-w-[1200px] border-collapse text-left">
        <caption className="sr-only">Rounds grouped by tester</caption>
        <thead>
          <tr className="border-b border-border text-xs font-medium text-muted-foreground">
            <th scope="col" className="w-12 py-2.5">
              <span className="sr-only">Details</span>
            </th>
            {HEADINGS.map((heading, i) => (
              <th
                key={heading}
                scope="col"
                className={`px-1.5 py-2.5 font-medium ${i >= 6 ? "text-right" : ""}`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        {groups.length === 0 && (
          <tbody>
            <tr>
              <td
                colSpan={COLUMNS}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                No rounds match.
              </td>
            </tr>
          </tbody>
        )}
        {groups.map((group) => (
          <tbody key={group.tester} aria-label={group.tester}>
            <tr className="border-b border-border bg-muted">
              <th scope="rowgroup" colSpan={COLUMNS} className="px-4 py-2.5">
                <span className="flex items-center gap-2.5 text-left">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-6 items-center justify-center rounded-full bg-primary-subtle text-[11px] font-semibold text-primary-text"
                  >
                    {group.tester.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold">{group.tester}</span>
                  {group.golden && (
                    <span className="inline-flex h-5 items-center rounded bg-card px-1.5 text-[11px] font-semibold text-muted-foreground">
                      Golden
                    </span>
                  )}
                  <span className="text-xs font-normal text-muted-foreground">
                    {plural(group.workspaces, "workspace")} ·{" "}
                    {plural(group.rounds, "round")} · {money(group.cost)}
                  </span>
                </span>
              </th>
            </tr>
            {group.rows.map((round) => (
              <RoundRow key={round.id} round={round} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
