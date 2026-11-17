import { Download } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { RoundTable } from "@/components/admin/round-table";
import { SummaryTiles } from "@/components/admin/summary-tiles";
import { buttonVariants } from "@/components/ui/button";
import {
  filterRounds,
  filtersQuery,
  groupByTester,
  loadAdmin,
  parseFilters,
  summarise,
  testerNames,
  unattributedTotal,
  withPreviewUrls,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default async function Page({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  const { rounds: all, unattributed } = await loadAdmin();
  const rounds = await withPreviewUrls(filterRounds(all, filters, new Date()));
  const query = filtersQuery(filters);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">
            All testers
          </h1>
          <p className="m-0 text-muted-foreground">
            Every workspace, grouped by tester name, including ones a tester
            deleted. Read-only.
          </p>
        </div>
        <a
          href={`/admin/export${query ? `?${query}` : ""}`}
          className={cn(buttonVariants({ variant: "outline" }), "no-underline")}
        >
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </a>
      </div>
      <SummaryTiles
        summary={summarise(rounds)}
        unattributed={unattributedTotal(unattributed, filters)}
      />
      <FilterBar filters={filters} testers={testerNames(all)} />
      <RoundTable groups={groupByTester(rounds)} />
    </div>
  );
}
