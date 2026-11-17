import type { Storage } from "@/lib/providers/storage";
import type { Fault } from "../fake";
import type { Candidate, Stage } from "../types";

export type ProgressEvent =
  | { kind: "planned"; candidates: Candidate[] }
  | { kind: "stage"; stage: Stage; done: number; total: number };

// The swappable services of a stage. The fake faults and the slow wait exist only while the stages are stubs.
export type StageDeps = {
  storage: Storage;
  progress: (event: ProgressEvent) => Promise<void>;
  fault: Fault | null;
  slowMs: number;
};
