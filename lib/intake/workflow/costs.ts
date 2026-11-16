import "server-only";
import { replaceIntakeCosts, type NewCost } from "@/lib/db/queries";
import { FIRECRAWL_USD_PER_CREDIT } from "@/lib/config";
import type { IntakeRun, Spend } from "./types";

function costRows({ costs, firecrawlRenders }: Spend): NewCost[] {
  return [
    ...costs.map((cost) => ({
      provider: cost.provider,
      model: cost.model,
      usd: cost.usd,
      meta: {},
    })),
    ...firecrawlRenders.map((url) => ({
      provider: "firecrawl" as const,
      model: null,
      usd: FIRECRAWL_USD_PER_CREDIT,
      meta: { url, credits: 1 },
    })),
  ];
}

export function recordCosts(
  run: IntakeRun,
  workspaceId: string | null,
  spend: Spend,
) {
  return replaceIntakeCosts(
    run.userId,
    run.intakeId,
    workspaceId,
    costRows(spend),
  );
}
