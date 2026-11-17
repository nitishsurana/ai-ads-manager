import "server-only";
import { replaceRoundCosts, type NewCost } from "@/lib/db/queries";
import type { RoundRun, Spend } from "./types";

export function recordCosts(run: RoundRun, { costs }: Spend) {
  const rows: NewCost[] = costs.map((cost) => ({
    provider: cost.provider,
    model: cost.model,
    usd: cost.usd,
    meta: cost.task ? { task: cost.task } : {},
  }));
  return replaceRoundCosts(run.userId, run.roundId, run.workspaceId, rows);
}
