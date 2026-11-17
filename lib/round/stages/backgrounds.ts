import { mapLimit } from "@/lib/intake";
import type { Candidate, RoundContext } from "../types";
import { createBuilder } from "./build";
import { isFatal } from "./errors";
import type { StageDeps } from "./types";

// Bria takes about 10 s a call; three at a time keeps six candidates well inside the deadline.
const CONCURRENCY = 3;

// A candidate whose background fails comes back without one: the checks redo it, like any other failing candidate.
export async function makeBackgrounds(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const builder = createBuilder(input, deps);
  let done = 0;
  return mapLimit(candidates, CONCURRENCY, async (candidate) => {
    let made = candidate;
    try {
      made = await builder.background(candidate);
    } catch (error) {
      if (isFatal(error)) throw error;
      console.warn(
        `round ${input.roundId}: candidate ${candidate.index} background failed`,
        error,
      );
    }
    await deps.progress({
      kind: "stage",
      stage: "making_backgrounds",
      done: ++done,
      total: candidates.length,
    });
    return made;
  });
}
