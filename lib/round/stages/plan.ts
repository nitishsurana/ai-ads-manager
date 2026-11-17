import { planRequest, validatePlan } from "../plan";
import type { Candidate, RoundContext } from "../types";
import type { StageDeps } from "./types";

export async function planCandidates(
  input: RoundContext,
  deps: StageDeps,
): Promise<Candidate[]> {
  const brief = await deps.brief();
  const { object } = await deps.ai.generate(planRequest(input.inputs, brief));
  const { candidates, repairs } = validatePlan(
    object,
    input.inputs,
    brief.approvedAngles,
    brief.settings,
  );
  if (repairs.length > 0) {
    console.warn(
      `round ${input.roundId}: plan repaired: ${repairs.join("; ")}`,
    );
  }
  await deps.progress({ kind: "planned", candidates });
  return candidates;
}
