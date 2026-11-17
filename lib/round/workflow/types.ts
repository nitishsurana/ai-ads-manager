import type { CostEntry } from "@/lib/intake";

// What the workflow is started with; everything here crosses step boundaries, so it stays plain data.
export type RoundRun = { userId: string; workspaceId: string; roundId: string };

export type Spend = { costs: CostEntry[] };

export type StageResult<T> = Spend &
  ({ kind: "ok"; value: T } | { kind: "error" } | { kind: "abandoned" });
