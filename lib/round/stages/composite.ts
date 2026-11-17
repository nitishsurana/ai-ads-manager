import type { Candidate, RoundContext } from "../types";
import { createBuilder } from "./build";
import { isFatal } from "./errors";
import type { StageDeps } from "./types";

// A candidate with no background, or one the text layer can't be drawn on, comes back without a preview: the checks redo it.
export async function composite(
  input: RoundContext,
  candidates: Candidate[],
  deps: StageDeps,
): Promise<Candidate[]> {
  const builder = createBuilder(input, deps);
  const composed: Candidate[] = [];
  for (const candidate of candidates) {
    let next = candidate;
    if (candidate.backgroundPath) {
      try {
        next = await builder.compose(candidate);
      } catch (error) {
        if (isFatal(error)) throw error;
        console.warn(
          `round ${input.roundId}: candidate ${candidate.index} composite failed`,
          error,
        );
      }
    }
    composed.push(next);
    await deps.progress({
      kind: "stage",
      stage: "compositing",
      done: composed.length,
      total: candidates.length,
    });
  }
  return composed;
}
