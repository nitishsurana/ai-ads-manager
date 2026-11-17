import { z } from "zod";
import type { AdminRound } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const filtersSchema = z.object({
  q: z.string().trim().catch(""),
  tester: z.string().catch(""),
  date: z.enum(["7", "30", "all"]).catch("all"),
  rating: z.enum(["any", "approved", "rejected"]).catch("any"),
  judge: z.enum(["any", "low", "high"]).catch("any"),
  confidence: z.enum(["any", "low"]).catch("any"),
});

export type AdminFilters = z.infer<typeof filtersSchema>;

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): AdminFilters {
  return filtersSchema.parse(
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, first(value)]),
    ),
  );
}

const DEFAULTS: AdminFilters = {
  q: "",
  tester: "",
  date: "all",
  rating: "any",
  judge: "any",
  confidence: "any",
};

// The query string that reproduces the filters; the CSV link carries it. Each filter is compared with its own default, so a search for "all" survives.
export function filtersQuery(filters: AdminFilters) {
  return new URLSearchParams(
    Object.entries(filters).filter(
      ([key, value]) => value !== DEFAULTS[key as keyof AdminFilters],
    ),
  ).toString();
}

export function filterRounds(
  rounds: AdminRound[],
  filters: AdminFilters,
  now: Date,
) {
  const needle = filters.q.toLowerCase();
  const since =
    filters.date === "all" ? 0 : now.getTime() - Number(filters.date) * DAY_MS;
  return rounds.filter((round) => {
    if (filters.tester && round.tester !== filters.tester) return false;
    if (Date.parse(round.startedAt) < since) return false;
    if (
      needle &&
      ![round.tester, round.title, round.store, round.sourceUrl].some((text) =>
        text.toLowerCase().includes(needle),
      )
    ) {
      return false;
    }
    const ratings = round.creatives.map((c) => c.rating);
    if (filters.rating === "approved" && !ratings.includes("approve")) {
      return false;
    }
    if (filters.rating === "rejected" && !ratings.includes("reject")) {
      return false;
    }
    const means = round.creatives.flatMap((c) =>
      c.judge ? [c.judge.mean] : [],
    );
    if (filters.judge === "low" && !means.some((mean) => mean <= 2)) {
      return false;
    }
    if (filters.judge === "high" && !means.some((mean) => mean >= 4)) {
      return false;
    }
    return (
      filters.confidence === "any" ||
      round.creatives.some((c) => c.judge?.lowConfidence)
    );
  });
}

// Costs of a set of rounds: each round's own, plus a workspace's setup cost once.
export function totalCost(rounds: AdminRound[]) {
  const setup = new Map(rounds.map((r) => [r.workspaceId, r.setupCost]));
  return (
    rounds.reduce((sum, round) => sum + round.cost, 0) +
    [...setup.values()].reduce((sum, cost) => sum + cost, 0)
  );
}

// Golden testers are the app's own checks, not tester work, so they stay out of the numbers. Rows for a workspace with no round count toward cost only.
export function summarise(rounds: AdminRound[]) {
  const counted = rounds.filter((round) => !round.golden);
  const played = counted.filter((round) => round.n !== null);
  const creatives = counted.flatMap((round) => round.creatives);
  const rated = creatives.filter((c) => c.rating !== null);
  const approved = rated.filter((c) => c.rating === "approve");
  const means = creatives.flatMap((c) => (c.judge ? [c.judge.mean] : []));
  const cost = totalCost(counted);
  return {
    rounds: played.length,
    creatives: creatives.length,
    rated: rated.length,
    approved: approved.length,
    approvalRate: rated.length ? approved.length / rated.length : null,
    meanJudge: means.length
      ? means.reduce((sum, mean) => sum + mean, 0) / means.length
      : null,
    edits: creatives.reduce((sum, c) => sum + c.edits, 0),
    cost,
    costPerRound: played.length ? cost / played.length : null,
  };
}

export type AdminSummary = ReturnType<typeof summarise>;

export function unattributedTotal(
  costs: { tester: string; usd: number }[],
  filters: AdminFilters,
) {
  return costs
    .filter((cost) => !filters.tester || cost.tester === filters.tester)
    .reduce((sum, cost) => sum + cost.usd, 0);
}

export type TesterGroup = {
  tester: string;
  golden: boolean;
  workspaces: number;
  rounds: number;
  cost: number;
  rows: AdminRound[];
};

// Testers are grouped by name: every browser is its own anonymous user, so one person can be several.
export function groupByTester(rounds: AdminRound[]): TesterGroup[] {
  const groups = new Map<string, AdminRound[]>();
  for (const round of rounds) {
    groups.set(round.tester, [...(groups.get(round.tester) ?? []), round]);
  }
  return [...groups.entries()]
    .map(([tester, rows]) => ({
      tester,
      golden: rows.every((r) => r.golden),
      workspaces: new Set(rows.map((r) => r.workspaceId)).size,
      rounds: rows.filter((r) => r.n !== null).length,
      cost: totalCost(rows),
      rows,
    }))
    .sort((a, b) => a.tester.localeCompare(b.tester));
}

export const testerNames = (rounds: AdminRound[]) =>
  [...new Set(rounds.map((round) => round.tester))].sort((a, b) =>
    a.localeCompare(b),
  );
