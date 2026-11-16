import type { CostEntry } from "../photos";

// Everything here crosses step boundaries, so it stays plain data.
export type IntakeRun = {
  userId: string;
  threadId: string;
  intakeId: string;
  url: string;
  deadlineAt: number;
};

export type Spend = { costs: CostEntry[]; firecrawlRenders: string[] };

export type StageResult<T> = Spend &
  ({ kind: "ok"; value: T } | { kind: "error" } | { kind: "abandoned" });

export type ProgressState = {
  stage: "photos" | "brand";
  phase?: "reading" | "checking";
  done?: number;
  total?: number;
  photos: { position: number; thumbPath: string }[];
};
