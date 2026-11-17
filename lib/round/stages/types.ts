import type { BriefContent } from "@/lib/brief/schema";
import type { Ai } from "@/lib/providers/ai";
import type { Storage } from "@/lib/providers/storage";
import type { Fault } from "../fake";
import type { Candidate, Stage } from "../types";

export type ProgressEvent =
  | { kind: "planned"; candidates: Candidate[] }
  | { kind: "stage"; stage: Stage; done: number; total: number };

// The swappable services of a stage. The no_pass fault exists only while the checks are a stub.
export type StageDeps = {
  ai: Ai;
  storage: Storage;
  // The brief version the round works from.
  brief: () => Promise<BriefContent>;
  progress: (event: ProgressEvent) => Promise<void>;
  fault: Fault | null;
};
