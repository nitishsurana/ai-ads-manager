import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

const SHOWN = 3;

// STUB (6a): the Layer 1 checks, the judge panel and the selection function replace this in 6d. It shows the first three candidates, or none under the no_pass fault.
export async function checkAndSelect(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  await deps.progress({
    kind: "stage",
    stage: "checking_quality",
    done: candidates.length,
    total: candidates.length,
  });
  return deps.fault === "no_pass" ? [] : candidates.slice(0, SHOWN);
}
