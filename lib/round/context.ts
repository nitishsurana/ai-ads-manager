import "server-only";
import type { Round } from "@/lib/db/queries";
import type { CostEntry } from "@/lib/intake";
import { roundInputsSchema } from "./inputs";
import type { RoundContext } from "./types";
import { createStepDeps } from "./workflow/deps";

const OFFLINE_DEADLINE_MS = 60_000;

// A finished round as the stages see a running one: its ids and the inputs frozen at its start.
export function contextOf(userId: string, round: Round): RoundContext {
  return {
    userId,
    workspaceId: round.workspaceId,
    roundId: round.id,
    n: round.n,
    attempt: round.attempt,
    briefVersion: round.briefVersion,
    inputs: roundInputsSchema.parse(round.inputs),
  };
}

// Services for work on a finished round; the caller records `costs`.
export function offlineDeps(context: RoundContext, costs: CostEntry[]) {
  return createStepDeps(context, {
    progress: async () => {},
    isAbandoned: () => false,
    costs,
    deadlineAt: Date.now() + OFFLINE_DEADLINE_MS,
  });
}
