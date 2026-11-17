import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

// STUB (6a): cut-outs, Bria backgrounds and whole-photo crops replace this in 6c.
export async function makeBackgrounds(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
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
