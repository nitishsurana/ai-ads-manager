import { setTimeout as sleep } from "node:timers/promises";
import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

// STUB (6a): cut-outs, Bria backgrounds and whole-photo crops replace this in 6c. The fake faults live here so the end-to-end tests can overrun the deadline or fail a round.
export async function makeBackgrounds(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  if (deps.fault === "fail") throw new Error("fake fault: backgrounds failed");
  if (deps.fault === "slow") await sleep(deps.slowMs);
  for (const [done] of candidates.entries()) {
    await deps.progress({
      kind: "stage",
      stage: "making_backgrounds",
      done: done + 1,
      total: candidates.length,
    });
  }
  return candidates;
}
